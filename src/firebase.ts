import { initializeApp } from "firebase/app";
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
  deleteDoc
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { WordDocument } from "./types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const WORDS_COLLECTION = "words";
const PAGE_SIZE = 12;

export const addWordToFirestore = async (wordData: Omit<WordDocument, 'id' | 'createdAt'>) => {
  try {
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
    let q;
    if (lastVisible) {
      q = query(
        collection(db, WORDS_COLLECTION),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
    } else {
      q = query(
        collection(db, WORDS_COLLECTION),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );
    }

    const querySnapshot = await getDocs(q);
    const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
    
    const words: WordDocument[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WordDocument));

    return { words, lastVisible: newLastVisible };
  } catch (error) {
    console.error("Error fetching words:", error);
    return { words: [], lastVisible: null };
  }
};