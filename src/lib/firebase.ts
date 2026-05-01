import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, query, collection, 
         limit, getDocs, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ✅ Use env vars instead of the local JSON file
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firestoreDatabaseId);
const storage = getStorage(app);

export { app, auth, db, storage };
export const googleProvider = new GoogleAuthProvider();

export const testFirebaseConnection = async () => {
  if (!db) return false;
  try {
    const testQuery = query(collection(db, 'users'), limit(1));
    await getDocs(testQuery);
    console.log('[Firebase] ✅ Connection successful');
    return true;
  } catch (error) {
    console.error('[Firebase] ❌ Connection failed:', error);
    return false;
  }
};

if (import.meta.env.DEV) {
  const runDiagnostics = async () => {
    console.log(`[Firebase Diagnostics] Project ID: ${firebaseConfig.projectId}`);
    console.log(`[Firebase Diagnostics] Firestore DB ID: ${firestoreDatabaseId}`);
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("[Firebase Diagnostics] Connection established successfully.");
    } catch (error: any) {
      if (error.message?.includes('the client is offline')) {
        console.error("Firebase: Client offline — check Project ID.");
      } else if (error.message?.includes('not-found') || error.message?.includes('database')) {
        console.error("Firebase: Database not found — check VITE_FIREBASE_DATABASE_ID.");
      }
    }
  };
  runDiagnostics();
}

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};
