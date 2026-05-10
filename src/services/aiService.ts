import { Type } from "@google/genai";
import { getGeminiClient, generateContent } from "../lib/gemini";

export interface SyllabusData {
  description: string;
  topics: string[];
  objectives: string[];
  learningOutcomes: string[];
}

export async function extractSyllabusFromUrl(url: string): Promise<SyllabusData | null> {
  try {
    const prompt = `Extract course information from this syllabus URL: ${url}. 
      Return a summary of the course description, the main modules/topics covered, the course objectives, and learning outcomes.\n\nPlease return a valid JSON object with the following exactly four keys: "description" (string), "topics" (array of strings), "objectives" (array of strings), "learningOutcomes" (array of strings). Do NOT include any markdown code blocks, just pure raw JSON.`;

    const response = await generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (!response.text) return null;
    
    let cleanText = response.text.trim();
    if(cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
    } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```\n?/, '').replace(/\n?```$/, '').trim();
    }

    const data = JSON.parse(cleanText);
    return data as SyllabusData;
  } catch (error) {
    console.error("Error extracting syllabus data from URL:", error);
    return null;
  }
}

export async function extractSyllabusFromFile(fileBase64: string, mimeType: string): Promise<SyllabusData | null> {
  try {
    const response = await generateContent({
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
              text: `Extract course information from this syllabus document. Return a summary of the course description, the main modules/topics covered, the course objectives, and learning outcomes.\n\nPlease return a valid JSON object with the following exactly four keys: "description" (string), "topics" (array of strings), "objectives" (array of strings), "learningOutcomes" (array of strings). Do NOT include any markdown code blocks, just pure raw JSON.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    if (!response.text) return null;
    
    let cleanText = response.text.trim();
    if(cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
    } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    const data = JSON.parse(cleanText);
    return data as SyllabusData;
  } catch (error) {
    console.error("Error extracting syllabus data from file:", error);
    return null;
  }
}
