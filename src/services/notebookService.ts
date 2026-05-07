
import { NotebookSource } from "../types";
import { getGeminiClient, DEFAULT_MODEL } from "../lib/gemini";

/**
 * Generates a summary for a notebook based on its sources.
 */
export async function generateNotebookSummary(name: string, sources: NotebookSource[]): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) return "AI summarization is unavailable. Please configure VITE_GEMINI_API_KEY.";

  const sourcesText = sources.map(s => `Source: ${s.title}\nContent: ${s.content}`).join('\n\n---\n\n');
  
  const prompt = `
    You are an expert study assistant. I have a notebook called "${name}" with the following sources:
    
    ${sourcesText}
    
    Please provide a concise but comprehensive summary of what this notebook is about and the key topics covered in the sources.
    Format your response in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are a research assistant summary tool. Be objective, concise, and academic."
      }
    });

    return response.text || "Summary unavailable.";
  } catch (error: any) {
    console.error("[Notebook] Summary error:", error?.message || error);
    return "Summary generation failed. Please try again.";
  }
}

/**
 * Multi-turn chat session grounded in notebook sources.
 */
export async function chatWithNotebook(
  notebookName: string, 
  sources: NotebookSource[], 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  userMessage: string
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) return "The AI notebook assistant requires a Gemini API key to function. Please configure VITE_GEMINI_API_KEY in your environment variables.";

  const sourcesText = sources.map(s => `[ID: ${s.id}] Source: ${s.title}\nContent: ${s.content}`).join('\n\n---\n\n');
  
  const systemInstruction = `
    You are an advanced AI study assistant for the IE MATRIX system, functioning like NotebookLM.
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

  try {
    // We use generateContent with the history provided
    const contents = [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.parts[0].text }] })),
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await ai.models.generateContent({ 
      model: DEFAULT_MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    return response.text || "I couldn't generate a response. Please try again.";
  } catch (error: any) {
    console.error("[Notebook] Chat error:", error?.message || error);
    return "I encountered an error. Please check your connection and try again.";
  }
}

/**
 * Searches for external resources based on a topic query. 
 */
export async function searchExternalResources(query: string): Promise<any[]> {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    Find high-quality academic and educational resources (articles, papers, study guides) related to: "${query}".
    Specifically focus on material relevant to Industrial Engineering if applicable.
    
    Output MUST be a JSON array of objects with 'title', 'url', and a short 'snippet'.
  `;

  try {
    const response = await ai.models.generateContent({ 
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = response.text;
    return JSON.parse(text || "[]");
  } catch (e) {
    console.error("Failed to parse search results:", e);
    return [];
  }
}
