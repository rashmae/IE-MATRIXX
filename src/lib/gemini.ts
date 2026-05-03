
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export const DEFAULT_MODEL = "gemini-2.0-flash";

export const getGeminiClient = () => {
  if (aiClient) return aiClient;

  // Following skill guidelines: Always use process.env.GEMINI_API_KEY for Gemini API in AI Studio
  // We include a fallback for local development if needed, but prioritize the required pattern.
  const apiKey = (process as any).env?.GEMINI_API_KEY || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    console.warn('[Gemini] API Key is missing. Batch ingestion and AI features will fail.');
    return null;
  }

  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
};

export async function generateStudyPlan(currentProgress: any, subjects: any[]) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    You are an expert Industrial Engineering Academic Advisor.
    Given the current progress of a student and the IE curriculum, generate a personalized study roadmap.
    
    Student Progress: ${JSON.stringify(currentProgress)}
    Curriculum: ${JSON.stringify(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, prerequisites: s.prerequisiteIds })))}
    
    Return a JSON array of objects. Each step should include:
    - title: String (e.g., "Master the Fundamentals")
    - description: String
    - subjects: Array of strings (subject codes)
    - difficulty: "easy" | "medium" | "hard"
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Study Plan Error:", error);
    return [];
  }
}

export async function askQuestion(question: string, context: string) {
  const ai = getGeminiClient();
  if (!ai) return "AI Assistant is currently unavailable.";

  const prompt = `
    You are an IE Matrix AI Tutor. 
    Question: ${question}
    Context (Subject Information): ${context}
    
    Provide a clear, helpful explanation. Use markdown for formatting.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt
    });
    return response.text || "Sorry, I couldn't process your request.";
  } catch (error) {
    console.error("Gemini QA Error:", error);
    return "Sorry, I couldn't process your request.";
  }
}

export async function generateQuiz(subjectName: string) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    Create a 5-question multiple choice quiz for the subject: ${subjectName}.
    The questions should be relevant to Industrial Engineering.
    
    Return a JSON array of objects:
    - question: String
    - options: Array of 4 strings
    - answerIndex: Number (0-3)
    - explanation: String
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    return [];
  }
}

export async function getCurriculumAdvice(userProgress: any, subjects: any[]) {
  const ai = getGeminiClient();
  if (!ai) return "I'm sorry, I couldn't generate advice at the moment.";

  const prompt = `
    You are an academic advisor for Industrial Engineering students. You power the IE MATRIX system.
    
    Current Curriculum: ${JSON.stringify(subjects.map(s => ({ code: s.code, name: s.name, year: s.yearLevel, sem: s.semester })))}
    User Progress: ${JSON.stringify(userProgress)}
    
    Based on the student's progress and the curriculum, provide:
    1. A brief encouraging greeting.
    2. 3 specific pieces of advice for their next semester.
    3. Identify any potential prerequisite bottlenecks they should be aware of.
    
    Keep the tone professional, encouraging, and concise. Format the response in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt
    });
    return response.text || "I'm sorry, I couldn't generate advice at the moment.";
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    return "I'm sorry, I couldn't generate advice at the moment. Please try again later.";
  }
}

export async function searchExternalResources(topic: string) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    Search for high-quality external learning resources (PDFs, YouTube videos, academic sites) for the Industrial Engineering topic: ${topic}.
    
    Return a JSON array of objects, each containing:
    - title: String (catchy title)
    - description: String (brief summary)
    - url: String (a valid-looking sample URL or resource hint)
    - type: "video" | "pdf" | "article" | "course"
    
    Provide 3-5 relevant results.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("External Search Error:", error);
    return [];
  }
}
