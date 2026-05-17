import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_GROQ_MODEL = "llama3-8b-8192";
export const DEFAULT_OPENROUTER_MODEL = "mistralai/mistral-7b-instruct:free";

// RULE 1: NEVER use process.env in Vite — it does not exist in the browser
// RULE 2: NEVER initialize GoogleGenAI at module load time — it crashes if key is missing
// RULE 3: Always lazy-initialize with a singleton pattern
// RULE 4: Always return null gracefully — never throw from getGeminiClient()

let _geminiClient: GoogleGenAI | null = null;

function getEnvKey(keyName: string): string | null {
  let apiKey: string | null = null;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta.env as any)?.[keyName]) {
      apiKey = (import.meta.env as any)[keyName];
    }
    if (!apiKey && typeof process !== 'undefined') {
      apiKey = (process as any)?.env?.[keyName.replace('VITE_', '')] || (process as any)?.env?.[keyName];
    }
    if (!apiKey && typeof window !== 'undefined') {
      apiKey = (window as any)[`__${keyName}__`];
    }
  } catch (err) {
    // ignore
  }
  return !apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '' ? null : apiKey;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (_geminiClient) return _geminiClient;
  const apiKey = getEnvKey('VITE_GEMINI_API_KEY');
  if (!apiKey) return null;
  
  try {
    _geminiClient = new GoogleGenAI({ apiKey });
    return _geminiClient;
  } catch {
    return null;
  }
}

export type AIProvider = 'gemini' | 'groq' | 'openrouter' | null;

export function getActiveProvider(): AIProvider {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ie_matrix_ai_provider') as AIProvider;
    if (saved === 'gemini') return 'gemini';
    if (saved === 'groq' && getEnvKey('VITE_GROQ_API_KEY')) return 'groq';
    if (saved === 'openrouter' && getEnvKey('VITE_OPENROUTER_API_KEY')) return 'openrouter';
  }

  // Default to gemini as it is usually available via server proxy
  return 'gemini';
}

export function setProviderPreference(provider: AIProvider) {
  if (typeof window !== 'undefined' && provider) {
    localStorage.setItem('ie_matrix_ai_provider', provider);
  }
}

export function getAvailableProviders(): { id: string, name: string, active: boolean }[] {
  const providers = [];
  const active = getActiveProvider();
  
  // Gemini is always listed since we have a server proxy
  providers.push({ id: 'gemini', name: 'Gemini 2.0 Flash', active: active === 'gemini' });
  
  if (getEnvKey('VITE_GROQ_API_KEY')) providers.push({ id: 'groq', name: 'Groq (Llama 3 8B)', active: active === 'groq' });
  if (getEnvKey('VITE_OPENROUTER_API_KEY')) providers.push({ id: 'openrouter', name: 'OpenRouter (Mistral 7B)', active: active === 'openrouter' });
  
  return providers;
}

export function isAIAvailable(): boolean {
  // Always available via Gemini server proxy by default
  return true;
}

async function fetchOpenAICompatible(apiUrl: string, apiKey: string, model: string, prompt: string, jsonMode: boolean, systemInstruction?: string) {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const body: any = {
    model,
    messages,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function fetchGroq(prompt: string, jsonMode: boolean, systemInstruction?: string) {
  const apiKey = getEnvKey('VITE_GROQ_API_KEY');
  if (!apiKey) return "";
  return fetchOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", apiKey, DEFAULT_GROQ_MODEL, prompt, jsonMode, systemInstruction);
}

async function fetchOpenRouter(prompt: string, jsonMode: boolean, systemInstruction?: string) {
  const apiKey = getEnvKey('VITE_OPENROUTER_API_KEY');
  if (!apiKey) return "";
  const hdrs: any = {
    "HTTP-Referer": window.location.href, // Required for OpenRouter
    "X-Title": "IE MATRIX" // Optional
  };
  
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const body: any = {
    model: DEFAULT_OPENROUTER_MODEL,
    messages,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...hdrs
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

// RULE 5: Every exported async function MUST:
// - Check getActiveProvider() first and return a typed fallback if null
// - Wrap generateContent in try/catch
// - Return a sensible fallback value, NEVER throw to the caller
// - Parse JSON safely with try/catch

async function safeGenerateContent(prompt: string, jsonMode = false, systemInstruction?: string): Promise<string> {
  const provider = getActiveProvider();
  
  if (!provider) return jsonMode ? '[]' : '';

  try {
    if (provider === 'gemini') {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt, 
          systemInstruction,
          model: DEFAULT_GEMINI_MODEL,
          responseMimeType: jsonMode ? "application/json" : "text/plain"
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let message = errData.error || `Server responded with ${response.status}`;
        if (errData.retryAfter) {
          message += ` (retry after ${errData.retryAfter}s)`;
        }
        const error = new Error(message);
        (error as any).status = response.status;
        (error as any).retryAfter = errData.retryAfter;
        throw error;
      }
      
      const data = await response.json();
      let text = data.text || (jsonMode ? '[]' : '');
      
      if (jsonMode && text.startsWith('```json')) {
        text = text.replace(/```json\n?/, '').replace(/\n?```$/, '');
      }
      return text;
    } else if (provider === 'groq') {
       const groqPrompt = jsonMode ? `${prompt}\n\nPlease output valid JSON ONLY.` : prompt;
       const response = await fetchGroq(groqPrompt, jsonMode, systemInstruction);
       return response || (jsonMode ? '[]' : '');
    } else if (provider === 'openrouter') {
       const orPrompt = jsonMode ? `${prompt}\n\nPlease output valid JSON ONLY.` : prompt;
       const response = await fetchOpenRouter(orPrompt, jsonMode, systemInstruction);
       return response || (jsonMode ? '[]' : '');
    }
  } catch (error: any) {
    console.error(`[AI ${provider}]`, error?.message || error);
    throw error; // Re-throw to allow component-level handling
  }
  
  return jsonMode ? '[]' : '';
}

export async function generateStudyPlan(currentProgress: any, subjects: any[]): Promise<any[]> {
  const text = await safeGenerateContent(`
    You are an elite academic planner for Industrial Engineering.
    Student Progress Data: ${JSON.stringify(currentProgress)}
    Curriculum Data: ${JSON.stringify(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, prerequisites: s.prerequisiteIds })))}
    
    TASK: Design an optimized, sequential study roadmap to help this student graduate efficiently while mastering the core engineering competencies.
    
    REQUIREMENTS:
    - Return a JSON array representing the optimal sequence of steps.
    - Each step object must have: 
      - title (string): E.g. "Foundation Phase 1", "Core IE Principles"
      - description (string): A motivating, strategic explanation of this phase.
      - subjects (array of strings): The subject codes to focus on in this step.
      - difficulty ("easy"|"medium"|"hard")
      - priority ("high"|"medium"|"low")
      - estimatedTime (string): E.g. "4 Weeks", "1 Semester"
      - breakdown (array of strings): 3 to 5 actionable bullet points on how to approach this specific combination of subjects.
      
    - ONLY provide the JSON array in the response, strictly formatted as valid JSON.
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch (e) { console.error('Failed to parse plan:\n', text); return []; }
}

export async function askQuestion(question: string, context: string): Promise<string> {
  return await safeGenerateContent(`
    Ctx: ${context}
    Q: ${question}
  `, false, "IE Advisor for CTU. Be encouraging, professional, and knowledgeable. Use real IE examples. Markdown format.");
}

export async function generateQuiz(subjectName: string): Promise<any[]> {
  const text = await safeGenerateContent(`
    Create a highly challenging and educational 5-question multiple-choice quiz for the Industrial Engineering subject: "${subjectName}".
    
    REQUIREMENTS:
    - Questions should test deep conceptual understanding, not just rote memorization.
    - Include scenarios or calculations where appropriate for IE concepts.
    - Return a valid JSON array of objects, where each object has:
      - question (string)
      - options (array of 4 distinct strings)
      - answerIndex (number 0-3 corresponding to the correct option)
      - explanation (string explaining WHY the answer is correct and why tricky distractors are wrong)
      
    ONLY output the raw JSON array.
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch { return []; }
}

export async function getCurriculumAdvice(userProgress: any, subjects: any[]): Promise<string> {
  const completedCount = Object.values(userProgress).filter((p: any) => p.status === 'done').length;
  const progressHash = `advice_${completedCount}_${subjects.length}_${Object.keys(userProgress).length}`;
  
  // Client-side cache check
  try {
    const cached = localStorage.getItem(progressHash);
    if (cached) {
      const { text, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 1000 * 60 * 60 * 24) { // 24 hour cache
        return text;
      }
    }
  } catch (e) { /* ignore */ }

  // Drastically minimize payload for advice
  const incompleteSubjects = subjects
    .filter(s => userProgress[s.id]?.status !== 'done')
    .map(s => ({ 
      id: s.id, 
      p: (s.prerequisiteIds || []).filter((pid: string) => userProgress[pid]?.status !== 'done'),
      y: s.yearLevel[0], // Only first char "1", "2" etc
      s: s.semester[0]   // Only first char "1", "2"
    }))
    .slice(0, 10); 

  const currentStatus = {
    pct: Math.round((completedCount / subjects.length) * 100)
  };

  try {
    const result = await safeGenerateContent(`
      Progress: ${currentStatus.pct}%
      Incomplete: ${JSON.stringify(incompleteSubjects)}
      TASK: Analyze progress. Provide advice.
    `, false, "You are an IE Advisor. 1) Encouraging greeting. 2) 3 data-driven tips. 3) Identify bottlenecks. Use Markdown. Very concise.");
    
    if (result) {
      try {
        localStorage.setItem(progressHash, JSON.stringify({ text: result, timestamp: Date.now() }));
      } catch (e) {}
    }

    return result || getStaticAdvice(userProgress, subjects);
  } catch (error: any) {
    if (error.status === 429 || error.message?.includes('429')) {
      // Return static advice if AI is capped
      return `🚨 **AI Quota Exhausted** (Free Tier Limit reached). \n\nI've generated this **Offline Expert Advice** for you while our AI systems synchronize: \n\n${getStaticAdvice(userProgress, subjects)}`;
    }
    throw error;
  }
}

/**
 * Provides helpful, non-AI advice based on year level and common IE bottlenecks.
 * This is used as a fallback when the Gemini Free Tier is exhausted.
 */
function getStaticAdvice(userProgress: any, subjects: any[]): string {
  // Determine current year level based on progress
  const completedIds = Object.keys(userProgress).filter(id => userProgress[id].status === 'done');
  const levelWeights = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4 };
  
  // Find highest year level with incomplete subjects
  const incompleteSubjects = subjects.filter(s => !completedIds.includes(s.id));
  const currentYear = incompleteSubjects.length > 0 
    ? incompleteSubjects[0].yearLevel 
    : '4th Year';

  const commonAdvice: Record<string, string[]> = {
    '1st Year': [
      "Focus intensely on your Mathematics foundations (Algebra, Calculus). These are the bedrock of Engineering.",
      "Join the Junior Philippine Institute of Industrial Engineers (JPIIE) early to build your professional network.",
      "Prioritize your **Computer Fundamentals**—Excel is an IE's most powerful tool for data analysis.",
      "Establish good study habits now; IE requires strong logical thinking and process orientation."
    ],
    '2nd Year': [
      "Prepare for **Operations Research**. It's logically demanding but defines the optimization core of IE.",
      "Stay meticulous with **Industrial Processes**. Understanding 'how things are made' is vital for future optimization.",
      "Don't neglect your **Thermodynamics**; it's a critical prerequisite for many higher-level lab subjects.",
      "Start exploring **Lean Manufacturing** concepts—they will make your 3rd-year subjects much clearer."
    ],
    '3rd Year': [
      "You are entering the 'IE Core'. Focus on **Ergonomics** and **Work Study** (Method Improvement).",
      "Start looking into **Lean Six Sigma White/Yellow Belt** certifications. They complement your 3rd-year coursework.",
      "Your **Statistical Quality Control** (SQC) skills will be highly marketable during your upcoming internship.",
      "Master **Production Planning and Control** (PPC)—it's the heart of manufacturing management."
    ],
    '4th Year': [
      "Prioritize your **Capital Project / Capstone**. Start data collection early to avoid graduation bottlenecks.",
      "Focus on **Supply Chain Management** trends like Industry 4.0, Green Logistics, and Digital Twins.",
      "Prepare for the **Certified Industrial Engineer (CIE)** exam by reviewing your 2nd and 3rd-year core notes.",
      "Networking is key—leverage your IE skills by solving a real problem for a local industry during your OJT."
    ]
  };

  const adviceList = commonAdvice[currentYear] || commonAdvice['1st Year'];
  const shuffled = [...adviceList].sort(() => 0.5 - Math.random());
  
  return `### IE Expert Guidance (${currentYear})
1. ${shuffled[0]}
2. ${shuffled[1]}
3. ${shuffled[2]}

**Pro-Tips for Success:**
- **Optimize your Schedule:** Use the **Catalog** to check prerequisites for upcoming semesters to avoid being 'blocked' by a failed subject.
- **Data over Opinions:** Industrial Engineering is about optimization. Always look for the data in your problems.
- **Stay Curious:** IE is broad. Whether it's ergonomics, supply chain, or operations research, find the niche that excites you!`;
}

export async function generateFlashcards(topic: string, count = 10): Promise<any[]> {
  const text = await safeGenerateContent(`
    Create ${count} advanced study flashcards for the Industrial Engineering topic: "${topic}".
    
    REQUIREMENTS:
    - Focus on crucial terms, formulas, methodologies, and frameworks.
    - Return ONLY a valid JSON array of objects with the exact schema:
      - front (string): The question or term (be concise).
      - back (string): The thorough, accurate answer or definition.
      - hint (string): A short contextual clue or mnemonic device to help remember it.
      
    ONLY output the raw JSON array.
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch { return []; }
}

export async function searchExternalResources(topic: string): Promise<any[]> {
  const text = await safeGenerateContent(`
    Recommend 4 exceptionally high-quality, practical learning resources (like textbooks, seminal papers, top YouTube channels, or platforms) for mastering the IE topic: "${topic}".
    
    REQUIREMENTS:
    - Output MUST be a valid JSON array of objects.
    - Schema: { title (string), description (string - why it's useful to an IE), url (string - provide a realistic search or direct link), type ("video"|"pdf"|"article"|"course") }
    
    ONLY output the raw JSON array.
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch { return []; }
}

export async function generateChatResponse(messages: {role: string; content: string}[], systemContext: string): Promise<string> {
  const history = messages.map(m => `${m.role === 'user' ? 'Student' : 'Advisor'}: ${m.content}`).join('\n');
  return await safeGenerateContent(`${systemContext}\n\nConversation:\n${history}\n\nAdvisor:`);
}

// Added back for custom components that might need direct model access securely
export async function generateContent(options: any) {
  const provider = getActiveProvider();
  if (!provider) return { text: "" };
  
  try {
     if (provider === 'gemini') {
         const response = await fetch("/api/ai/generate", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ 
             prompt: options.contents && typeof options.contents === 'string' ? options.contents : undefined,
             contents: options.contents && typeof options.contents !== 'string' ? options.contents : undefined,
             model: options.model || DEFAULT_GEMINI_MODEL,
             config: options.config
           }),
         });
         
         if (!response.ok) {
           const errData = await response.json().catch(() => ({}));
           throw new Error(errData.error || `Server responded with ${response.status}`);
         }
         
         const data = await response.json();
         return { text: data.text || "" };
     } else {
         // Transform options.contents into a prompt string for openrouter/groq
         let prompt = "";
         if (typeof options.contents === 'string') {
             prompt = options.contents;
         } else if (Array.isArray(options.contents)) {
             // simplified extraction
             prompt = options.contents.map(c => typeof c === 'string' ? c : c.parts ? c.parts.map((p:any) => p.text).join(' ') : JSON.stringify(c)).join('\n');
         } else if (options.contents?.parts) {
             prompt = options.contents.parts.map((p:any) => p.text).join(' ');
         } else {
             prompt = JSON.stringify(options.contents);
         }
         
         const isJson = options.config?.responseMimeType === "application/json";
         const sysInst = options.config?.systemInstruction;
         
         if (provider === 'groq') {
             const res = await fetchGroq(prompt, isJson, sysInst);
             return { text: res || "" };
         } else if (provider === 'openrouter') {
             const res = await fetchOpenRouter(prompt, isJson, sysInst);
             return { text: res || "" };
         }
     }
  } catch (error) {
    console.error("[generateContent Error]", error);
  }
  return { text: "" };
}
