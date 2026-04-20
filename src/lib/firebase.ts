import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Use the provided JSON config as the source of truth for AI Studio Build.
// Environment variables are supported but should be used with caution as they can cause mismatches.
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const jsonProjectId = firebaseConfigJson.projectId;

if (envProjectId && jsonProjectId && envProjectId !== jsonProjectId) {
  console.warn(`[Firebase Diagnostics] CONFIG MISMATCH: Environment settings are using "${envProjectId}" but the project config uses "${jsonProjectId}". Overriding environment to use the correct project config.`);
}

const config = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId || 'ai-studio-ed95dc68-ee18-4519-b44b-779a2b247f49'
};

const app = initializeApp(config);
export const auth = getAuth(app);

// Initialize Firestore with custom database ID and robust connection settings for restricted environments.
// We force long polling and disable fetch streams to bypass typical proxy issues in dev environments.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
} as any, config.firestoreDatabaseId);

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Connection Test
const testConnection = async () => {
  console.log(`[Firebase Diagnostics] Initializing connection test...`);
  console.log(`[Firebase Diagnostics] Project ID: ${config.projectId}`);
  console.log(`[Firebase Diagnostics] Firestore DB ID: ${config.firestoreDatabaseId || '(default)'}`);
  
  try {
    // Attempting a simple read to check connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("[Firebase Diagnostics] Connection established successfully.");
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.error("Firebase connection test: Client is offline. This usually means the Project ID is invalid or Firestore is not reachable. If you just updated your project, please refresh the page.");
    } else if (error.message?.includes('permission-denied') || error.message?.includes('insufficient permissions')) {
      // This is expected if the user is not signed in yet due to our rules
      console.log("[Firebase Diagnostics] Connection established successfully (Permission logic active).");
    } else {
      console.error("Firebase connection test error:", error.message);
    }
  }
};

if (process.env.NODE_ENV !== 'production') {
  testConnection();
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
