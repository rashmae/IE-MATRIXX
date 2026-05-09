import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SyllabusData {
  description: string;
  topics: string[];
  objectives: string[];
  learningOutcomes: string[];
}

export async function extractSyllabusFromUrl(url: string): Promise<SyllabusData | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Extract course information from this syllabus URL: ${url}. 
      Return a summary of the course description, the main modules/topics covered, the course objectives, and learning outcomes.`,
      config: {
        tools: [{ urlContext: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Brief course description" },
            topics: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of main topics or modules"
            },
            objectives: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of course objectives"
            },
            learningOutcomes: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of student learning outcomes"
            }
          },
          required: ["description", "topics", "objectives", "learningOutcomes"]
        }
      }
    });

    if (!response.text) return null;
    
    const data = JSON.parse(response.text.trim());
    return data as SyllabusData;
  } catch (error) {
    console.error("Error extracting syllabus data from URL:", error);
    return null;
  }
}

export async function extractSyllabusFromFile(fileBase64: string, mimeType: string): Promise<SyllabusData | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: fileBase64,
                mimeType: mimeType
              }
            },
            {
              text: "Extract course information from this syllabus document. Return a summary of the course description, the main modules/topics covered, the course objectives, and learning outcomes."
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Brief course description" },
            topics: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of main topics or modules"
            },
            objectives: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of course objectives"
            },
            learningOutcomes: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of student learning outcomes"
            }
          },
          required: ["description", "topics", "objectives", "learningOutcomes"]
        }
      }
    });

    if (!response.text) return null;
    
    const data = JSON.parse(response.text.trim());
    return data as SyllabusData;
  } catch (error) {
    console.error("Error extracting syllabus data from file:", error);
    return null;
  }
}
