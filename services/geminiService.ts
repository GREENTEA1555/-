import { GoogleGenerativeAI } from "@google/generative-ai";

// 這裡我們暫時留空，避免因為找不到 key 而當機
// 如果您之後有申請 Gemini API Key，可以填在這裡
const API_KEY = ""; 

const getClient = () => {
  if (!API_KEY) {
    // 溫和地警告，不會讓網站崩潰
    console.warn("未設定 API Key，AI 自動撰寫功能目前無法使用。");
    return null;
  }
  return new GoogleGenerativeAI(API_KEY);
};

export const generatePartDescription = async (partName: string, category: string, subcategory?: string): Promise<string> => {
  const genAI = getClient();
  if (!genAI) return "請先設定 API Key 才能使用 AI 撰寫功能。";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const subcatContext = subcategory ? `子分類/類型: ${subcategory}` : '';
    const prompt = `
      你是一位專業的遊戲主機維修技師與電商賣家。
      請為以下的維修零件撰寫一段簡潔、專業且具銷售吸引力的產品描述（繁體中文，台灣用語，40字以內）。
      
      零件名稱: ${partName}
      主機平台: ${category}
      ${subcatContext}
      
      重點放在兼容性、品質與解決什麼故障問題。
      請直接回傳描述文字，不要加引號或其他廢話。
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text || "無法生成描述。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成描述失敗，請稍後再試。";
  }
};