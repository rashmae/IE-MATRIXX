import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

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
      const response = await fetch(driveUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Drive error: ${response.statusText}` });
      }

      // Proxy headers
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      
      // Stream the response
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
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
