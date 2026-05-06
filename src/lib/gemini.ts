
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

// Always use gemini-2.0-flash as per AGENTS.md
export const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Initializes and returns the Gemini client using the available API key.
 * Prioritizes process.env.GEMINI_API_KEY (AI Studio provided) or falls back to VITE_GEMINI_API_KEY.
 */
export const getGeminiClient = () => {
  if (aiClient) return aiClient;

  const apiKey = (process as any).env?.GEMINI_API_KEY || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    console.warn('[Gemini] API Key is missing. AI features will be disabled.');
    return null;
  }

  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
};

/**
 * Generates a structured study plan (roadmap) based on student progress.
 */
export async function generateStudyPlan(currentProgress: any, subjects: any[]) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    As an expert Industrial Engineering advisor at Cebu Technological University (CTU), 
    generate a multi-step learning roadmap for a student with the following academic data:
    
    Current Progress (Subject Statuses & Grades):
    ${JSON.stringify(currentProgress)}
    
    IE Curriculum Subjects:
    ${JSON.stringify(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, year: s.yearLevel, sem: s.semester })))}

    The roadmap should be logical, prioritizing prerequisites and focusing on areas where the student might need improvement based on their grades (CTU Scale: 1.0 Excellent, 5.0 Failed).
    
    Output MUST be a JSON array of objects with the following schema:
    [
      {
        "id": "unique-id",
        "title": "Topic or Stage Name",
        "description": "Short explanation",
        "subjects": ["Subject Code 1", "Subject Code 2"],
        "estimatedWeeks": "Integer or Range string",
        "status": "locked" | "current" | "completed",
        "category": "core" | "technical" | "general",
        "priority": "high" | "medium" | "low",
        "breakdown": ["Outcome 1", "Outcome 2"]
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "[]";
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Gemini Study Plan Error:", error);
    return [];
  }
}

/**
 * Generic Q&A function with context grounding.
 */
export async function askQuestion(question: string, context: string) {
  const ai = getGeminiClient();
  if (!ai) return "AI Assistant is currently unavailable.";

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: `Context:\n${context}\n\nQuestion: ${question}` }] }],
      config: {
        systemInstruction: "You are the IE MATRIX Assistant, a helpful AI advisor for Industrial Engineering students at CTU. Provide accurate, academic, and encouraging responses. Use the provided context to GROUND your answers. Format your output with Markdown."
      }
    });

    return response.text || "I'm sorry, I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini QA Error:", error);
    return "I encountered an error while processing your question. Please try again later.";
  }
}

/**
 * Generates an AI quiz based on subject content or general IE topics.
 */
export async function generateQuiz(subjectName: string) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    Create a 5-question multiple choice quiz for the subject: ${subjectName}.
    The questions should be relevant to Industrial Engineering.
    
    Output MUST be a JSON array:
    [
      {
        "question": "The question text",
        "options": ["Option 0", "Option 1", "Option 2", "Option 3"],
        "answerIndex": number, // 0-3
        "explanation": "Brief explanation"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
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

/**
 * Provides curriculum advice based on current GWA and subject performance.
 */
export async function getCurriculumAdvice(userProgress: any, subjects: any[]) {
  const ai = getGeminiClient();
  if (!ai) return "I'm sorry, I couldn't generate advice at the moment.";

  const prompt = `
    Analyze this student's performance:
    Progress: ${JSON.stringify(userProgress)}
    Curriculum: ${JSON.stringify(subjects.map(s => ({ code: s.code, name: s.name, year: s.yearLevel, sem: s.semester })))}

    Based on the student's progress and the curriculum, provide:
    1. A brief encouraging greeting.
    2. 3 specific pieces of advice for their next semester.
    3. Identify any potential prerequisite bottlenecks they should be aware of.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are an expert IE academic advisor for CTU. Be professional, encouraging, and concise. Format the response in Markdown."
      }
    });

    return response.text || "I'm sorry, I couldn't generate advice at the moment.";
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    return "I'm sorry, I couldn't generate advice at the moment. Please try again later.";
  }
}

/**
 * Searches for external IE resources based on a topic.
 */
export async function searchExternalResources(topic: string) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    Search for high-quality external learning resources (PDFs, YouTube videos, academic sites) for the Industrial Engineering topic: ${topic}.
    
    Output MUST be a JSON array of objects:
    [
      {
        "title": "Clear Title",
        "description": "Brief summary",
        "url": "Valid URL or placeholder",
        "type": "video" | "pdf" | "article" | "course"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini External Search Error:", error);
    return [];
  }
}
