import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, query, collection, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
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

// Diagnostics log
if (process.env.NODE_ENV !== 'production') {
  const runDiagnostics = async () => {
    console.log(`[Firebase Diagnostics] Project ID: ${firebaseConfig.projectId}`);
    console.log(`[Firebase Diagnostics] Firestore DB ID: ${firebaseConfig.firestoreDatabaseId}`);
    
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("[Firebase Diagnostics] Connection established successfully.");
    } catch (error: any) {
      if (error.message?.includes('the client is offline')) {
        console.error("Firebase connection test: Client is offline. This usually means the Project ID is invalid or Firestore is not reachable.");
      } else if (error.message?.includes('not-found') || error.message?.includes('database')) {
        console.error("Firebase connection test: Database not found. Please verify VITE_FIREBASE_DATABASE_ID.");
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
