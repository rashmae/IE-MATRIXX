import { NotebookSource } from "../types";
import { getGeminiClient, DEFAULT_MODEL } from "../lib/gemini";

export async function generateNotebookSummary(name: string, sources: NotebookSource[]) {
  const ai = getGeminiClient();
  if (!ai) return "AI Summary is currently unavailable.";

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
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Summary Error:", error);
    return "Failed to generate summary.";
  }
}

export async function chatWithNotebook(
  notebookName: string, 
  sources: NotebookSource[], 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  userMessage: string
) {
  const ai = getGeminiClient();
  if (!ai) return "AI Chat is currently unavailable.";

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
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: history.map(h => ({ role: h.role, parts: h.parts })).concat([{ role: 'user', parts: [{ text: userMessage }] }]),
      config: {
        systemInstruction: systemInstruction
      }
    });

    return response.text;
  } catch (error) {
    console.error("Notebook Chat Error:", error);
    return "I encounterered an error while processing your request.";
  }
}

export async function searchExternalResources(query: string) {
  const ai = getGeminiClient();
  if (!ai) return [];

  const prompt = `
    Find high-quality academic and educational resources (articles, papers, study guides) related to: "${query}".
    Specifically focus on material relevant to Industrial Engineering if applicable.
    
    Return the results in a JSON array of objects with 'title', 'url', and a short 'snippet'.
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
  } catch (e) {
    console.error("Failed to parse search results:", e);
    return [];
  }
}
