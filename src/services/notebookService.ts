import { GoogleGenAI, Type } from "@google/genai";
import { NotebookSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateNotebookSummary(name: string, sources: NotebookSource[]) {
  const sourcesText = sources.map(s => `Source: ${s.title}\nContent: ${s.content}`).join('\n\n---\n\n');
  
  const prompt = `
    You are an expert study assistant. I have a notebook called "${name}" with the following sources:
    
    ${sourcesText}
    
    Please provide a concise but comprehensive summary of what this notebook is about and the key topics covered in the sources.
    Format your response in Markdown.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
}

export async function chatWithNotebook(
  notebookName: string, 
  sources: NotebookSource[], 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  userMessage: string
) {
  const sourcesText = sources.map(s => `[ID: ${s.id}] Source: ${s.title}\nContent: ${s.content}`).join('\n\n---\n\n');
  
  const systemInstruction = `
    You are an advanced AI study assistant for the CTU IE Matrix system, functioning like NotebookLM.
    Your knowledge is strictly grounded in the provided sources for the notebook "${notebookName}".
    
    CURRENT SOURCES:
    ${sourcesText}
    
    GUIDELINES:
    1. Answer questions based ONLY on the provided sources.
    2. If the answer isn't in the sources, state that you don't know based on the current context.
    3. Use citations when possible by referring to the Source ID, e.g., "[ID: XYZ]".
    4. Provide helpful, academic, and encouraging responses.
    5. You can summarize, explain complex concepts, or quiz the user based on their sources.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    config: {
      systemInstruction,
    }
  });

  return response.text;
}

export async function searchExternalResources(query: string) {
  const prompt = `
    Find high-quality academic and educational resources (articles, papers, study guides) related to: "${query}".
    Specifically focus on material relevant to Industrial Engineering if applicable.
    
    Return the results in a JSON array of objects with 'title', 'url', and a short 'snippet'.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            url: { type: Type.STRING },
            snippet: { type: Type.STRING }
          },
          required: ["title", "url", "snippet"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse search results:", e);
    return [];
  }
}
