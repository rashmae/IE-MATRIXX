
// gemini.ts - Updated to use central server-side proxy
export const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Generic fetcher for AI generation tasks
 */
async function callAIProxy(options: { 
  prompt: string; 
  systemInstruction?: string; 
  responseMimeType?: string;
  model?: string;
}) {
  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("[AI Proxy Error]:", error);
    throw error;
  }
}

/**
 * Advanced pass-through for multi-part requests (e.g. including files)
 */
export async function generateContent(options: any) {
  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("[AI Proxy generateContent Error]:", error);
    throw error;
  }
}

/**
 * Generates a structured study plan (roadmap) based on student progress.
 */
export async function generateStudyPlan(currentProgress: any, subjects: any[]) {
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
    const text = await callAIProxy({ prompt, responseMimeType: "application/json" });
    return JSON.parse(text || "[]");
  } catch (error) {
    return [];
  }
}

/**
 * Generic Q&A function with context grounding.
 */
export async function askQuestion(question: string, context: string) {
  try {
    return await callAIProxy({
      prompt: `Context:\n${context}\n\nQuestion: ${question}`,
      systemInstruction: "You are the IE MATRIX Assistant, a helpful AI advisor for Industrial Engineering students at CTU. Provide accurate, academic, and encouraging responses. Use the provided context to GROUND your answers. Format your output with Markdown."
    });
  } catch (error) {
    return "I encountered an error while processing your question. Please try again later.";
  }
}

/**
 * Generates an AI quiz based on subject content or general IE topics.
 */
export async function generateQuiz(subjectName: string) {
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
    const text = await callAIProxy({ prompt, responseMimeType: "application/json" });
    return JSON.parse(text || "[]");
  } catch (error) {
    return [];
  }
}

/**
 * Provides curriculum advice based on current GWA and subject performance.
 */
export async function getCurriculumAdvice(userProgress: any, subjects: any[]) {
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
    return await callAIProxy({
      prompt,
      systemInstruction: "You are an expert IE academic advisor for CTU. Be professional, encouraging, and concise. Format the response in Markdown."
    });
  } catch (error) {
    return "I'm sorry, I couldn't generate advice at the moment. Please try again later.";
  }
}

/**
 * Searches for external IE resources based on a topic.
 */
export async function searchExternalResources(topic: string) {
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
    const text = await callAIProxy({ prompt, responseMimeType: "application/json" });
    return JSON.parse(text || "[]");
  } catch (error) {
    return [];
  }
}

// Export for legacy compatibility or direct access if needed
export const getGeminiClient = () => {
  console.warn("getGeminiClient is deprecated. Using server-side proxy instead.");
  return null;
};
