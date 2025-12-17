import { initializeApp, getApps, getApp, deleteApp, FirebaseApp, FirebaseOptions } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  where
} from "firebase/firestore";
import { getAuth, User, signInAnonymously } from "firebase/auth";
import { WordDocument, UserProfile, DailyComment } from "./types";

// --- 1. 設定の取得と初期化ロジック ---

const defaultFirebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
export const fetchAllWords = async (userId: string) => {
  try {
    // limit() や startAfter() を使わずにクエリを作成
    // ※もし userId でフィルタリングしている場合は where('userId', '==', userId) を入れてください
    const q = query(
      collection(db, "words"), // コレクション名はご自身の環境に合わせてください
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    // データを整形して返す
    const words = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WordDocument[];

    return words;
  } catch (error) {
    console.error("Error fetching all words:", error);
    return [];
  }
};
const getEffectiveConfig = (): FirebaseOptions => {
  try {
    const customConfigStr = localStorage.getItem('custom_firebase_config');
    if (customConfigStr) {
      return JSON.parse(customConfigStr);
    }
  } catch (e) {
    console.error("Failed to parse custom firebase config from localStorage", e);
  }
  return defaultFirebaseConfig;
};

const initApp = (): FirebaseApp => {
  const config = getEffectiveConfig();
  if (!getApps().length) {
    return initializeApp(config);
  } else {
    return getApp();
  }
};

const authApp = getApps().find(app => app.name === "[DEFAULT]") || initializeApp(defaultFirebaseConfig);
export const auth = getAuth(authApp);
const userDb = getFirestore(authApp); 

// --- データ用アプリの初期化（カスタム設定対応） ---
const getCustomConfig = (): FirebaseOptions | null => {
  try {
    const customConfigStr = localStorage.getItem('custom_firebase_config');
    if (customConfigStr) {
      return JSON.parse(customConfigStr);
    }
  } catch (e) {
    console.error("Failed to parse custom firebase config", e);
  }
  return null;
};

let dataApp: FirebaseApp;
const customConfig = getCustomConfig();

if (customConfig) {
    dataApp = getApps().find(app => app.name === "dataApp") || initializeApp(customConfig, "dataApp");
    const dataAuth = getAuth(dataApp);
    signInAnonymously(dataAuth).catch((err) => {
        console.warn("Failed to sign in anonymously to custom data app", err);
    });
} else {
    dataApp = authApp;
}

// カスタム設定がある場合はそのDB、なければデフォルトDB
export const db = getFirestore(dataApp);

const WORDS_COLLECTION = "words";
const USERS_COLLECTION = "users";
const DAILY_COMMENTS_COLLECTION = "Comments"; // ルートコレクション名
const PAGE_SIZE = 12;

// --- 2. 設定検証・保存用関数 ---
export const validateAndSaveConfig = async (configInput: string): Promise<FirebaseOptions> => {
  try {
    let configObject: any;

    const braceStart = configInput.indexOf('{');
    const braceEnd = configInput.lastIndexOf('}');
    
    let objectString = configInput;
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      objectString = configInput.substring(braceStart, braceEnd + 1);
    }

    try {
      const parseFn = new Function(`return ${objectString};`);
      configObject = parseFn();
    } catch (syntaxError) {
      let jsonString = objectString
        .replace(/\/\/.*$/gm, '') 
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":') 
        .replace(/:\s*'([^']+)'/g, ': "$1"') 
        .replace(/,(\s*})/g, '$1'); 
      configObject = JSON.parse(jsonString);
    }

    if (!configObject) throw new Error("Failed to parse configuration object.");

    const parsedConfig = configObject as FirebaseOptions;
    const requiredFields = ['apiKey', 'authDomain', 'projectId'];
    for (const field of requiredFields) {
      // @ts-ignore
      if (!parsedConfig[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const tempAppName = "validator_" + Date.now();
    const tempApp = initializeApp(parsedConfig, tempAppName);
    
    try {
      const tempAuth = getAuth(tempApp);
      if (!tempAuth) throw new Error("Auth initialization failed");
      
      await deleteApp(tempApp);
      
      localStorage.setItem('custom_firebase_config', JSON.stringify(parsedConfig));
      
      return parsedConfig;

    } catch (innerError) {
      await deleteApp(tempApp);
      throw innerError;
    }

  } catch (error) {
    console.error("Config validation error:", error);
    throw new Error("Invalid Configuration: " + (error instanceof Error ? error.message : "Unknown error"));
  }
};

// --- 3. User Management Functions ---

export const saveUserToFirestore = async (user: User) => {
  if (!user) return;
  const userRef = doc(userDb, USERS_COLLECTION, user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    try {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        createdAt: Timestamp.now(),
        settings: {
          language: 'ja',
          geminiKey: ''
        }
      });
    } catch (e) {
      console.error("Error creating user profile:", e);
    }
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
    const userRef = doc(userDb, USERS_COLLECTION, uid);
    await setDoc(userRef, data, { merge: true });
};

export const getUserProfile = async (uid: string) => {
    const userRef = doc(userDb, USERS_COLLECTION, uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
    }
    return null;
};

// --- 4. Word Management Functions ---

export const addWordToFirestore = async (wordData: Omit<WordDocument, 'id' | 'createdAt'>) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User must be logged in to add words");

    const docRef = await addDoc(collection(db, WORDS_COLLECTION), {
      ...wordData,
      createdAt: Timestamp.now(), 
      comment :''
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const updateWord = async (id: string, data: Partial<WordDocument>) => {
    const wordRef = doc(db, WORDS_COLLECTION, id);
    await updateDoc(wordRef, data);
};

export const updateWordExample = async (id: string, examples: WordDocument['examples']) => {
    const wordRef = doc(db, WORDS_COLLECTION, id);
    await updateDoc(wordRef, {examples});
};

export const updateWordComment = async (id: string, comment: WordDocument['comment']) => {
  const wordRef = doc(db, WORDS_COLLECTION, id);
  await updateDoc(wordRef, {comment});
};

export const updateWordStatus = async (id: string, status: WordDocument['status']) => {
    const wordRef = doc(db, WORDS_COLLECTION, id);
    await updateDoc(wordRef, { status });
};

export const deleteWord = async (id: string) => {
    await deleteDoc(doc(db, WORDS_COLLECTION, id));
};

export const fetchWords = async (lastVisible: QueryDocumentSnapshot<DocumentData> | null) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return { words: [], lastVisible: null };

    let constraints: any[] = [
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
    ];

    if (lastVisible) {
        constraints.push(startAfter(lastVisible));
    }

    const q = query(
      collection(db, WORDS_COLLECTION),
      ...constraints
    );

    const querySnapshot = await getDocs(q);
    const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
    
    const words: WordDocument[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WordDocument));

    return { words, lastVisible: newLastVisible };
  } catch (error: any) {
    console.error("Error fetching words:", error);
    return { words: [], lastVisible: null };
  }
};

// ★変更: ルートの "Comments" コレクションから取得 (userIdはパスには含めないが、シグネチャは維持)
// DBインスタンスは `db` (custom/dataApp) を使用
export const getDailyComment = async (userId: string, dateStr: string): Promise<string> => {
    // doc(db, "Comments", dateStr)
    const docRef = doc(db, DAILY_COMMENTS_COLLECTION, dateStr);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data().content || '';
    }
    return '';
};

export const getDailyCommentHistory = async (userId: string): Promise<(DailyComment & { id: string })[]> => {
  try {
    // collection(db, "Comments")
    const commentsRef = collection(db, DAILY_COMMENTS_COLLECTION);
    
    const q = query(commentsRef, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      date: doc.data().date,
      content: doc.data().content,
      updatedAt: doc.data().updatedAt,
      ...doc.data()
    } as DailyComment & { id: string }));
  } catch (error) {
    console.error("Error fetching comment history:", error);
    return [];
  }
};

export const saveDailyComment = async (userId: string, dateStr: string, content: string) => {
    // doc(db, "Comments", dateStr)
    // 個別のDB前提のため、日付をドキュメントIDとして使用
    const docRef = doc(db, DAILY_COMMENTS_COLLECTION, dateStr);
    await setDoc(docRef, {
        date: dateStr,
        content: content,
        updatedAt: Timestamp.now(),
        userId: userId // 念のためユーザーIDもフィールドとして保存
    }, { merge: true });
};