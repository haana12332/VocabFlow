import { Timestamp } from "firebase/firestore";

export type WordStatus = "Beginner" | "Training" | "Mastered";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: any;
  settings?: {
    language?: string;     // 母国語設定
    geminiKey?: string;    // APIキー
    firebaseConfig?: string; // Firebase設定 (必要な場合)
    geminiModel?: string;   // Geminiモデル
  };
}

export interface AIWordResponse {
  id?: string;
  pronunciationURL: string;
  status: WordStatus;
  createdAt: Date | Timestamp;
  english: string;
  meaning: string;
  coreImage: string;
  category: string;
  partOfSpeech: string[];
  toeicLevel: number;
  examples: {
    sentence: string;
    translation: string;
  }; 
}

export interface WordDocument {
    id: string;
    english: string;
    meaning: string;
    coreImage: string;
    category: string;
    partOfSpeech: string[];
    toeicLevel: number; // 600, 800, 990 etc.
    examples: {
        sentence: string;
        translation: string;
    }[]; 
    status: WordStatus;
    pronunciationURL: string;
    createdAt: any; // Firestore Timestamp
    comment:string;
}

export enum QuizMode {
  CONFIG = 'CONFIG',
  STANDARD = 'STANDARD',
  AI_CHAT = 'AI_CHAT'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isCorrect?: boolean;
}

export interface DailyComment {
  date: string;
  content: string;
  updatedAt: Timestamp;
}