
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });

const DEFAULT_MODEL = "gemini-3-flash-preview";

export async function generateStudyPlan(currentProgress: any, subjects: any[]) {
  const prompt = `
    You are an expert Industrial Engineering Academic Advisor.
    Given the current progress of a student and the IE curriculum, generate a personalized study roadmap.
    
    Student Progress: ${JSON.stringify(currentProgress)}
    Curriculum: ${JSON.stringify(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, prerequisites: s.prerequisiteIds })))}
    
    Return a JSON array of steps. Each step should include:
    - title: String (e.g., "Master the Fundamentals")
    - description: String
    - subjects: Array of strings (subject codes)
    - difficulty: "easy" | "medium" | "hard"
    
    Focus on prerequisite satisfaction and logical learning flow.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
}

export async function askQuestion(question: string, context: string) {
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
    console.error("Gemini Error:", error);
    return "Sorry, I couldn't process your request.";
  }
}

export async function generateQuiz(subjectName: string) {
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
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    return [];
  }
}

export async function getCurriculumAdvice(userProgress: any, subjects: any[]) {
  const prompt = `
    You are an academic advisor for Industrial Engineering students at Cebu Technological University (CTU).
    
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
