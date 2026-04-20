import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// In AI Studio Build, we prefer environment variables for flexibility.
// These are defined in .env.example and should be provided by the platform or .env file.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 'ai-studio-ed95dc68-ee18-4519-b44b-779a2b247f49'
};

// Check if critical config is missing
const isFirebaseConfigured = !!config.apiKey && !!config.projectId;

if (!isFirebaseConfigured) {
  console.warn("[Firebase] Warning: Firebase configuration is incomplete. Please ensure VITE_FIREBASE_* environment variables are set.");
}

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
  if (!isFirebaseConfigured) return;
  
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
