
import { NotebookSource } from "../types";
import { generateContent, isAIAvailable } from "../lib/gemini";

/**
 * Generates a summary for a notebook based on its sources.
 */
export async function generateNotebookSummary(name: string, sources: NotebookSource[]): Promise<string> {
  if (!isAIAvailable()) return "AI summarization is unavailable. Please configure an AI API Key.";

  const sourcesText = sources.map(s => `Source: ${s.title}\nContent: ${s.content}`).join('\n\n---\n\n');
  
  const prompt = `
    You are an elite research summarizer and synthesizer.
    I have a notebook called "${name}" containing the following distinct sources:
    
    ${sourcesText}
    
    TASK: Provide a comprehensive, highly-structured executive summary of these sources.
    
    REQUIREMENTS:
    - Write a short abstract (3-4 sentences) summarizing the main theme.
    - Extract and list 3-5 core principles or key takeaways.
    - Highlight any contradictions or overlaps between the sources.
    - Use Markdown formatting (headings, bold text, bullet points).
    - Be objective, academic, and highly precise.
  `;

  try {
    const response = await generateContent({
      contents: prompt,
      config: {
        systemInstruction: "You are an elite academic summarizer for IE MATRIX. Break down complex material strictly using the provided sources."
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
  if (!isAIAvailable()) return "The AI notebook assistant requires an API key to function. Please configure an AI API Key in your environment variables.";

  const sourcesText = sources.map(s => `[ID: ${s.id}] Source: ${s.title}\nContent: ${s.content}`).join('\n\n---\n\n');
  
  const systemInstruction = `
    You are an elite academic AI assistant for the IE MATRIX platform, functioning similarly to NotebookLM.
    Your objective is to help Industrial Engineering students deeply understand and synthesize information from their specific notebook: "${notebookName}".
    
    CURRENT KNOWLEDGE BASE (Strict Bounds):
    ${sourcesText}
    
    CRITICAL GUIDELINES:
    1. EXCLUSIVE SOURCING: You MUST base your answers entirely on the provided sources. Do not inject outside facts unless explicitly asked to relate the source to general IE principles.
    2. TRANSPARENCY: If a user asks a question whose answer is NOT found in the sources, you must explicitly state: "Based on the provided sources, I cannot answer this. However..." and then you may optionally provide general context.
    3. CITATIONS: You MUST cite your claims extensively using the Source ID exactly like this: [ID: XYZ].
    4. TONE: Be highly academic, encouraging, and analytical. Push the student to think critically.
    5. FORMATTING: Use Markdown rigorously. Use bold text for key terms and lists for sequential logic.
  `;

  try {
    // We use generateContent with the history provided
    const contents = [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.parts[0].text }] })),
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await generateContent({ 
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
  if (!isAIAvailable()) return [];

  const prompt = `
    Find high-quality academic and educational resources (articles, papers, study guides) related to: "${query}".
    Specifically focus on material relevant to Industrial Engineering if applicable.
    
    Output MUST be a JSON array of objects with 'title', 'url', and a short 'snippet'.
  `;

  try {
    const response = await generateContent({ 
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    let text = response.text || "[]";
    if (text.startsWith('```json')) {
      text = text.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse search results:", e);
    return [];
  }
}
