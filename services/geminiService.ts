
import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generatePartDescription = async (partName: string, category: string, subcategory?: string): Promise<string> => {
  const ai = getClient();
  if (!ai) return "Error: API Key missing. Unable to generate description.";

  try {
    const subcatContext = subcategory ? `Subcategory/Type: ${subcategory}` : '';
    const prompt = `
      You are an expert video game console repair technician.
      Write a concise, professional, and sales-oriented product description (max 40 words) for a replacement part.
      
      Part Name: ${partName}
      Console System: ${category}
      ${subcatContext}
      
      Focus on compatibility, quality, and technical specs if relevant.
      Return plain text only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate description. Please try again.";
  }
};
