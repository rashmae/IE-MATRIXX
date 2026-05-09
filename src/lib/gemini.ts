import { GoogleGenAI } from "@google/genai";

export const DEFAULT_MODEL = "gemini-2.0-flash";

// RULE 1: NEVER use process.env in Vite — it does not exist in the browser
// RULE 2: NEVER initialize GoogleGenAI at module load time — it crashes if key is missing
// RULE 3: Always lazy-initialize with a singleton pattern
// RULE 4: Always return null gracefully — never throw from getGeminiClient()

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (_client) return _client;
  
  // Three-tier API key resolution for maximum reliability across AI Studio & Vercel
  let apiKey: string | null = null;

  try {
    // 1. Vite build-time (Vercel production)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    }
    
    // 2. Runtime Node/AI Studio fallback
    if (!apiKey && typeof process !== 'undefined') {
      apiKey = (process as any)?.env?.GEMINI_API_KEY || (process as any)?.env?.VITE_GEMINI_API_KEY;
    }

    // 3. Runtime injection fallback for iframe/embedded contexts
    if (!apiKey && typeof window !== 'undefined') {
      apiKey = (window as any).__GEMINI_API_KEY__;
    }
  } catch (err) {
    console.error('[Gemini] Key resolution error:', err);
  }

  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '') {
    return null;
  }

  try {
    _client = new GoogleGenAI({ apiKey });
    return _client;
  } catch {
    return null;
  }
}

export function isAIAvailable(): boolean {
  return getGeminiClient() !== null;
}

// RULE 5: Every exported async function MUST:
// - Check getGeminiClient() first and return a typed fallback if null
// - Wrap generateContent in try/catch
// - Return a sensible fallback value, NEVER throw to the caller
// - Use responseMimeType: "application/json" only for JSON responses
// - Parse JSON safely with try/catch

async function safeGenerateContent(prompt: string, jsonMode = false, systemInstruction?: string): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) return jsonMode ? '[]' : '';
  
  try {
    const config: any = {
      model: DEFAULT_MODEL,
      contents: prompt,
      config: jsonMode ? { 
        responseMimeType: "application/json",
        systemInstruction: systemInstruction 
      } : {
        systemInstruction: systemInstruction
      }
    };

    const response = await ai.models.generateContent(config);
    return response.text || (jsonMode ? '[]' : '');
  } catch (error: any) {
    console.error('[Gemini]', error?.message || error);
    return jsonMode ? '[]' : '';
  }
}

export async function generateStudyPlan(currentProgress: any, subjects: any[]): Promise<any[]> {
  const text = await safeGenerateContent(`
    You are an expert Industrial Engineering Academic Advisor.
    Student Progress: ${JSON.stringify(currentProgress)}
    Curriculum: ${JSON.stringify(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, prerequisites: s.prerequisiteIds })))}
    Return a JSON array. Each step: { title, description, subjects (array of codes), difficulty ("easy"|"medium"|"hard"), priority ("high"|"medium"|"low"), estimatedTime, breakdown (array of strings) }
  `, true);
  try { return JSON.parse(text); } catch { return []; }
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
    Return JSON array: [{ question, options (4 strings), answerIndex (0-3), explanation }]
  `, true);
  try { return JSON.parse(text); } catch { return []; }
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
    Return JSON array: [{ front (question/term), back (answer/definition), hint (optional) }]
  `, true);
  try { return JSON.parse(text); } catch { return []; }
}

export async function searchExternalResources(topic: string): Promise<any[]> {
  const text = await safeGenerateContent(`
    Suggest 4 high-quality learning resources for IE topic: ${topic}.
    Return JSON array: [{ title, description, url, type ("video"|"pdf"|"article"|"course") }]
  `, true);
  try { return JSON.parse(text); } catch { return []; }
}

export async function generateChatResponse(messages: {role: string; content: string}[], systemContext: string): Promise<string> {
  const history = messages.map(m => `${m.role === 'user' ? 'Student' : 'Advisor'}: ${m.content}`).join('\n');
  return await safeGenerateContent(`${systemContext}\n\nConversation:\n${history}\n\nAdvisor:`);
}

// Added back for custom components that might need direct model access securely
export async function generateContent(options: any) {
  const ai = getGeminiClient();
  if (!ai) return { text: "" };
  
  try {
     // The @google/genai SDK expects contents as an array of objects with parts
     // or a single content object. We'll pass it through nearly as is.
     const response = await ai.models.generateContent({
       model: options.model || DEFAULT_MODEL,
       contents: options.contents,
       config: options.config
     });
     return { text: response.text || "" };
  } catch (error) {
    console.error("[Gemini generateContent Error]", error);
    return { text: "" };
  }
}
