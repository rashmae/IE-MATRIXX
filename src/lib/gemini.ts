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
  if (getEnvKey('VITE_GEMINI_API_KEY')) return 'gemini';
  if (getEnvKey('VITE_GROQ_API_KEY')) return 'groq';
  if (getEnvKey('VITE_OPENROUTER_API_KEY')) return 'openrouter';
  return null;
}

export function isAIAvailable(): boolean {
  return getActiveProvider() !== null;
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
      const ai = getGeminiClient();
      if (!ai) return jsonMode ? '[]' : '';
      const config: any = {
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: jsonMode ? { 
          responseMimeType: "application/json",
          systemInstruction: systemInstruction 
        } : {
          systemInstruction: systemInstruction
        }
      };
      const response = await ai.models.generateContent(config);
      let text = response.text || (jsonMode ? '[]' : '');
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
  }
  
  return jsonMode ? '[]' : '';
}

export async function generateStudyPlan(currentProgress: any, subjects: any[]): Promise<any[]> {
  const text = await safeGenerateContent(`
    You are an expert Industrial Engineering Academic Advisor.
    Student Progress: ${JSON.stringify(currentProgress)}
    Curriculum: ${JSON.stringify(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, prerequisites: s.prerequisiteIds })))}
    Return a JSON array containing the study plan. Each step object must have: { title, description, subjects (array of codes), difficulty ("easy"|"medium"|"hard"), priority ("high"|"medium"|"low"), estimatedTime, breakdown (array of strings) }. Provide ONLY the JSON array.
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch (e) { console.error('Failed to parse plan:\n', text); return []; }
}

export async function askQuestion(question: string, context: string): Promise<string> {
  return await safeGenerateContent(`
    You are the IE Matrix AI Tutor for Industrial Engineering students at CTU.
    Context: ${context}
    Question: ${question}
    Provide a clear, helpful explanation. Use markdown for formatting.
  `, false, "You are the IE MATRIX Assistant, a helpful AI advisor for Industrial Engineering students at CTU. Provide accurate, academic, and encouraging responses. Use the provided context to GROUND your answers. Format your output with Markdown.");
}

export async function generateQuiz(subjectName: string): Promise<any[]> {
  const text = await safeGenerateContent(`
    Create a 5-question multiple choice quiz for: ${subjectName} (Industrial Engineering).
    Return ONLY a JSON array of objects with: { question, options (4 strings), answerIndex (0-3), explanation }
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch { return []; }
}

export async function getCurriculumAdvice(userProgress: any, subjects: any[]): Promise<string> {
  const result = await safeGenerateContent(`
    You are an academic advisor for CTU Industrial Engineering students powering IE MATRIX.
    Curriculum: ${JSON.stringify(subjects.map(s => ({ code: s.code, name: s.name, year: s.yearLevel, sem: s.semester })))}
    User Progress: ${JSON.stringify(userProgress)}
    Provide: 1) Brief encouraging greeting 2) 3 specific pieces of advice 3) Prerequisite bottlenecks.
    Format in Markdown. Be concise and encouraging.
  `, false, "You are an expert IE academic advisor for CTU. Be professional, encouraging, and concise. Format the response in Markdown.");
  return result || "Welcome! Keep up the great work on your IE journey. Check the roadmap for your next steps.";
}

export async function generateFlashcards(topic: string, count = 10): Promise<any[]> {
  const text = await safeGenerateContent(`
    Generate ${count} flashcards for the IE topic: ${topic}.
    Return ONLY a JSON array of objects with: { front (question/term), back (answer/definition), hint (optional) }
  `, true);
  try { 
      const cleanText = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleanText); 
  } catch { return []; }
}

export async function searchExternalResources(topic: string): Promise<any[]> {
  const text = await safeGenerateContent(`
    Suggest 4 high-quality learning resources for IE topic: ${topic}.
    Return ONLY a JSON array of objects with: { title, description, url, type ("video"|"pdf"|"article"|"course") }
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
         const ai = getGeminiClient();
         if (!ai) return { text: "" };
         const response = await ai.models.generateContent({
           model: options.model || DEFAULT_GEMINI_MODEL,
           contents: options.contents,
           config: options.config
         });
         return { text: response.text || "" };
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
