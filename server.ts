import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;
const initGemini = () => {
  if (geminiClient) return geminiClient;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not found in environment. AI features will fail.");
    return null;
  }
  
  geminiClient = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  return geminiClient;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin SDK lazily
  let adminApp: admin.app.App | null = null;
  const initAdmin = () => {
    if (adminApp) return adminApp;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const databaseURL = process.env.FIREBASE_DATABASE_URL;

    if (!serviceAccountJson || !databaseURL) {
      console.warn("Firebase Admin credentials not fully configured. Admin features may be disabled.");
      return null;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });
      console.log("Firebase Admin SDK initialized successfully.");
      return adminApp;
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK:", error);
      return null;
    }
  };

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

// AI Proxy Routes with basic caching and retry logic
  const aiCache = new Map<string, { text: string; expiry: number }>();
  const CACHE_TTL = 1000 * 60 * 60; // 1 hour for AI responses (most curriculum advice is stable)

  // Track if we are globally blocked by a 429
  let globalBlockedUntil = 0;

  app.post("/api/ai/generate", async (req, res) => {
    const { prompt, systemInstruction, responseMimeType, model = "gemini-2.0-flash", contents, config } = req.body;
    
    // Check global block first
    const now = Date.now();
    if (globalBlockedUntil > now) {
      const wait = Math.ceil((globalBlockedUntil - now) / 1000);
      return res.status(429).json({ 
        error: "Gemini API Quota Exceeded. The free tier is overloaded.",
        retryAfter: wait,
        isGlobalBlock: true
      });
    }

    // Cache lookup
    const cacheKey = JSON.stringify({ prompt, systemInstruction, model, contents });
    const cached = aiCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return res.json({ text: cached.text });
    }

    const ai = initGemini();
    if (!ai) {
      return res.status(503).json({ error: "AI Service Not Configured" });
    }

    const maxRetries = 2; // Reduced retries to avoid compounding the quota issue
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const generationConfig = config || {
          systemInstruction,
          responseMimeType
        };

        const finalContents = contents || [{ role: 'user', parts: [{ text: prompt }] }];

        const response = await ai.models.generateContent({
          model,
          contents: finalContents,
          config: generationConfig
        });
        
        const textResponse = response.text;
        
        // Update cache
        aiCache.set(cacheKey, { text: textResponse, expiry: Date.now() + CACHE_TTL });
        
        return res.json({ text: textResponse });
      } catch (error: any) {
        lastError = error;
        const status = error.status || error.code || 500;
        
        // If 429, retry with backoff or specific delay
        if (status === 429 || error.message?.includes('429')) {
          let retryDelaySeconds = 20;

          // Attempt to extract the specific retry delay from the error details if available
          try {
            const errorBody = typeof error.message === 'string' && error.message.includes('{') 
              ? JSON.parse(error.message.substring(error.message.indexOf('{'))) 
              : error;
              
            const retryInfo = errorBody?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
            if (retryInfo?.retryDelay) {
              retryDelaySeconds = parseInt(retryInfo.retryDelay.replace('s', '')) || 20;
            } else {
              // Try regex as backup
              const match = error.message?.match(/retry in (\d+\.?\d*)s/i) || 
                            error.message?.match(/wait (\d+)s/i);
              if (match) retryDelaySeconds = parseFloat(match[1]);
            }
          } catch (e) {}

          const waitTimeMs = (retryDelaySeconds + 1) * 1000;

          if (waitTimeMs > 10000) { // If wait is long, don't hold the request, block globally and return
            globalBlockedUntil = Date.now() + waitTimeMs;
            break;
          }

          attempt++;
          if (attempt < maxRetries) {
            console.log(`Gemini 429: Retrying in ${waitTimeMs.toFixed(0)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTimeMs));
            continue;
          }
        }
        
        // If not 429 or max retries reached, break and handle error
        break;
      }
    }

    console.error("Gemini API Proxy Error after retries:", lastError);
    if (lastError.message?.includes('429') || lastError.status === 429) {
      let finalRetryDelay = 45; // Default longer delay for global block
      try {
        // Extract "retry in 36.317501497s" or similar
        const match = lastError.message?.match(/retry in (\d+\.?\d*)s/i) || 
                      lastError.message?.match(/retry after (\d+)s/i);
        if (match) finalRetryDelay = Math.ceil(parseFloat(match[1])) + 5;
      } catch (e) {}

      // Block globally for the remainder of the retry window plus a safety buffer
      globalBlockedUntil = Math.max(globalBlockedUntil, Date.now() + finalRetryDelay * 1000);

      return res.status(429).json({ 
        error: "Gemini API Quota Exceeded. The free tier is currently overloaded.",
        details: lastError.message,
        retryAfter: finalRetryDelay
      });
    }
    
    res.status(500).json({ error: lastError.message || "Failed to generate content after retries" });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy endpoint for Google Drive PDFs
  app.get("/api/proxy-drive", async (req, res) => {
    const fileId = req.query.id;
    if (!fileId) return res.status(400).json({ error: "Missing file ID" });

    try {
      const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(driveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        // If it's a 403, it might be due to virus scan warning for large files.
        // Try the preview link instead? No, that's HTML.
        // Let's just return the status.
        return res.status(response.status).json({ error: `Drive error: ${response.statusText}` });
      }

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Proxy failed to fetch from Drive" });
    }
  });

  // Example Admin Route
  app.get("/api/admin/check", (req, res) => {
    const admin = initAdmin();
    if (admin) {
      res.json({ status: "Admin SDK is active", project: admin.options.projectId });
    } else {
      res.status(503).json({ error: "Admin SDK not configured" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
