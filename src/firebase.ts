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
import { WordDocument, UserProfile } from "./types";

// --- 1. 設定の取得と初期化ロジック ---

// デフォルトの設定（環境変数から - Auth & ユーザー設定用）
const defaultFirebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 有効な設定を取得する関数（ローカルストレージ優先）
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

// アプリの初期化（二重初期化防止）
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


// B. データ用設定（単語データ保存用）
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
    // カスタム設定がある場合、名前付きアプリ "dataApp" として初期化
    dataApp = getApps().find(app => app.name === "dataApp") || initializeApp(customConfig, "dataApp");
    console.log("Using Custom Firebase Project for Data");

    // カスタム側のアプリにも匿名ログインして、Firestoreのアクセス権(request.auth)を確保する
    const dataAuth = getAuth(dataApp);
    signInAnonymously(dataAuth).catch((err) => {
        console.warn("Failed to sign in anonymously to custom data app. Firestore might be blocked.", err);
    });

} else {
    // カスタム設定がない場合、Authと同じデフォルトアプリを使用
    dataApp = authApp;
    console.log("Using Default Firebase Project for Data");
}

export const db = getFirestore(dataApp);

const WORDS_COLLECTION = "words";
const USERS_COLLECTION = "users";
const PAGE_SIZE = 12;


// --- 2. 設定検証・保存用関数 ---

export const validateAndSaveConfig = async (configInput: string): Promise<FirebaseOptions> => {
  try {
    let configObject: any;

    // 1. 入力がJavaScriptコード形式 ("const firebaseConfig = { ... }") の場合、オブジェクト部分を抽出
    const braceStart = configInput.indexOf('{');
    const braceEnd = configInput.lastIndexOf('}');
    
    let objectString = configInput;
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      objectString = configInput.substring(braceStart, braceEnd + 1);
    }

    // 2. JavaScriptオブジェクトとして解析
    try {
      const parseFn = new Function(`return ${objectString};`);
      configObject = parseFn();
    } catch (syntaxError) {
      console.warn("JS evaluation failed, falling back to JSON cleaning strategy", syntaxError);
      
      let jsonString = objectString
        .replace(/\/\/.*$/gm, '') 
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":') 
        .replace(/:\s*'([^']+)'/g, ': "$1"') 
        .replace(/,(\s*})/g, '$1'); 
      configObject = JSON.parse(jsonString);
    }

    if (!configObject) {
        throw new Error("Failed to parse configuration object.");
    }

    const parsedConfig = configObject as FirebaseOptions;

    // 3. 必須フィールドのチェック
    const requiredFields = ['apiKey', 'authDomain', 'projectId'];
    for (const field of requiredFields) {
      // @ts-ignore
      if (!parsedConfig[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // 4. テスト用のFirebaseアプリを初期化して接続確認
    const tempAppName = "validator_" + Date.now();
    const tempApp = initializeApp(parsedConfig, tempAppName);
    
    try {
      const tempAuth = getAuth(tempApp);
      if (!tempAuth) throw new Error("Auth initialization failed");
      
      await deleteApp(tempApp);
      
      // 5. 有効な設定をローカルストレージに保存
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
      // userId: currentUser.uid, // ★削除: ユーザーIDは保存しない
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

    // ★修正: ユーザーIDのフィルタを削除しました
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
    if (error.code === 'failed-precondition') {
        console.warn("Firestore index required. Click the link in the error message above to create it.");
    }
    return { words: [], lastVisible: null };
  }
};