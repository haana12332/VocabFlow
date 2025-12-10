import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import { WordDocument } from "../types";

// ▼ 変更: 定数を削除し、許可されたモデルのリストを定義
const ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

// --- ヘルパー関数: 設定とAIクライアントを動的に取得 ---
const getAIConfig = () => {
  // 1. APIキーの取得 (localStorage優先 -> 環境変数)
  const localKey = localStorage.getItem('gemini_api_key');
  // const apiKey = localKey || import.meta.env.VITE_GOOGLE_AI_KEY;
  const apiKey = localKey

  if (!apiKey) {
    console.error("エラー: Google AI APIキーが見つかりません。設定画面か.envファイルを確認してください。");
    throw new Error("API Key is missing");
  }
  // ▼ 追加: モデル設定の取得と検証
  const storedModel = localStorage.getItem('gemini_model');
  // 指定されたモデル以外が入っていた場合はデフォルトに戻す（安全策）
  const modelName = (storedModel && ALLOWED_MODELS.includes(storedModel)) 
    ? storedModel 
    : DEFAULT_MODEL;

  // 2. 言語設定の取得と変換
  const langCode = localStorage.getItem('app_language') || 'en';
  
  // プロンプト用に言語名を変換
  const langMap: Record<string, string> = {
    'ja': 'Japanese',
    'en': 'English', // 英語設定の場合は英英定義になります
    'es': 'Spanish',
    'ko': 'Korean'
  };
  const targetLang = langMap[langCode] || 'English';

  return {
    ai: new GoogleGenerativeAI(apiKey),
    modelName,
    targetLang,
    langCode
  };
};

// 2. 変数に : Schema という型注釈を付け、as const は削除します
const WORD_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    english: { type: SchemaType.STRING },
    meaning: { type: SchemaType.STRING },
    coreImage: { type: SchemaType.STRING },
    category: { type: SchemaType.STRING },
    toeicLevel: { type: SchemaType.NUMBER },
    partOfSpeech: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    examples: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sentence: { type: SchemaType.STRING },
          translation: { type: SchemaType.STRING },
        },
      },
    },
  },
  required: ["english", "meaning", "coreImage", "category", "toeicLevel", "partOfSpeech", "examples"],
};

// JSON文字列を掃除するヘルパー関数
const cleanJsonString = (text: string): string => {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = text.match(fenceRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  
  let startIndex = -1;
  let endIndex = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    endIndex = text.lastIndexOf("}");
  } 
  else if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIndex = firstBracket;
    endIndex = text.lastIndexOf("]");
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return text.slice(startIndex, endIndex + 1);
  }

  return text;
};

export const generateWordInfo = async (englishWord: string): Promise<Partial<WordDocument>> => {
  // 設定を動的に取得
  const { ai, targetLang,modelName } = getAIConfig();

  const prompt = `Generate detailed vocabulary information for the English word/phrase "${englishWord}".
  Return a JSON object.
  Fields required:
  - english: string (the word itself)
  - meaning: string (Meaning or Translation in **${targetLang}**)
  - coreImage: string (Brief explanation of the core image/etymology in **${targetLang}**)
  - category: string ( Category when use this word must be strictly one of the following: Business, Daily, Health, Technology, Shopping, Finance, Restaurants, Emotions, Relationships, Nature, Transportation, Academic, Travel, Science, Other.)
  - partOfSpeech: array of strings (Must be in English, e.g., Noun, Verb, Adjective, Prepositions, Adverbs, Conjunctions, others). IMPORTANT: If the input contains spaces (e.g. "pick up", "sort out"), STRICTLY classify it as "Idiom".
  - toeicLevel: number (Estimated TOEIC score level required for this word, Must be in 400, 600, 730, 860, 990)
  - examples: array of objects with 'sentence' (English) and 'translation' (Translation in **${targetLang}**)
  `;

  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: WORD_SCHEMA,
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    
    if (rawText) {
      const jsonString = cleanJsonString(rawText);
      const data = JSON.parse(jsonString);

      if (data.english.trim().includes(' ') && !data.partOfSpeech.includes('Idiom')) {
        data.partOfSpeech = ['Idiom'];
      }

      return {
        ...data,
        status: "Beginner",
        pronunciationURL: `https://www.google.com/search?q=${data.english}+pronunciation`
      };
    }
    throw new Error("No content generated");
  } catch (error:any) {
    console.error("generateWordInfo Error:", error);
    const errorMessage = error.message || "Unknown error";
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        throw new Error(`Model ${modelName} not found or not available. Please check settings.`);
    } else if (errorMessage.includes("400") || errorMessage.includes("API key")) {
        throw new Error("Invalid API Key. Please check settings.");
    }
    throw new Error("Failed to generate word info");
  }
};

export const generateBulkWordInfo = async (inputString: string): Promise<Partial<WordDocument>[]> => {
  // 設定を動的に取得
  const { ai, targetLang,modelName } = getAIConfig();

  const prompt = `Generate detailed vocabulary information for the following English words: "${inputString}".
    Return a JSON Array of objects.
    Fields required for each object:
    - english: string
    - meaning: string (Meaning or Translation in **${targetLang}**) 
    - coreImage: string (Brief explanation of the core image/etymology in **${targetLang}**)
    - category: string  Category when use this word must be strictly one of the following: Business, Daily, Health, Technology, Shopping, Finance, Restaurants, Emotions, Relationships, Nature, Transportation, Academic, Travel, Science, Other.)
    - partOfSpeech: array of strings (English). Set to 'Idiom' if it is a phrase.
    - toeicLevel: number (Estimated TOEIC score level required for this word, Must be in 400, 600, 730, 860, 990)
    - examples: array of objects {sentence, translation (in **${targetLang}**)}
    `;

  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      // 配列のスキーマ定義
      responseSchema: {
        type: SchemaType.ARRAY,
        items: WORD_SCHEMA,
      },
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    if (rawText) {
      const jsonString = cleanJsonString(rawText);
      const list = JSON.parse(jsonString);
      
      return list.map((data: any) => ({
        ...data,
        status: "Beginner",
        partOfSpeech: (data.english.trim().includes(' ') && !data.partOfSpeech.includes('Idiom')) ? ['Idiom'] : data.partOfSpeech,
        pronunciationURL: `https://www.google.com/search?q=${data.english}+pronunciation`
      }));
    }
    throw new Error("No content generated");
  } catch (error) {
    console.error("generateBulkWordInfo Error:", error);
    throw new Error("Failed to generate bulk info");
  }
};

export const createQuizChat = (words: WordDocument[]) => {
  // 設定を動的に取得
  const { ai, targetLang,modelName } = getAIConfig();

  const wordList = words.map(w => `${w.english} (${w.meaning})`).join(", ");

  const systemInstruction = `You are an expert English teacher for students who speak **${targetLang}**.
  The user is studying these words: [${wordList}].
  
  Your goal is to quiz the user based on their specific requests (e.g. "Create a TOEIC 800 grammar question").

  Protocol:
  1. Wait for the user to tell you what kind of quiz they want.
  2. Create a question using the provided words if possible.
  3. CRITICAL RULES:
      - The **Question** text must be in **ENGLISH**.
      - The **Explanation/Feedback** must be in **${targetLang}**.
  4. Marking:
      - If the user's answer is correct, start your response strictly with "【正解】".
      - If it is incorrect, start with "【不正解】".
      - Include the English word involved in the question in brackets like [WORD] after the result tag so the system can track it. 
  
  Example Interaction (assuming target language is Japanese):
  User: "TOEIC 800 grammar question please"
  AI: "Fill in the blank: The manager decided to _____ the meeting. (call off / pick up)"
  User: "call off"
  AI: "【正解】[call off] 正解です！ 'Call off' は '中止する' という意味です。..."
  
  Example Wrong:
  User: "pick up"
  AI: "【不正解】[call off] 残念、不正解です。正解は 'call off' です..."
  `;

  const model = ai.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction,
  });

  return model.startChat();
};