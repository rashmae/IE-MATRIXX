import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, collection, getDocs, limit, query } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Validation for ALL config values
const requiredEnvVars = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_DATABASE_ID: import.meta.env.VITE_FIREBASE_DATABASE_ID,
};

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    console.error(`Missing environment variable: ${key}`);
  }
});

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

// Debug log to confirm values load correctly on next deploy
console.log(
  '[Firebase Config Check]',
  {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅ set' : '❌ missing',
    databaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID ? '✅ set' : '❌ missing',
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '✅ set' : '❌ missing',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅ set' : '❌ missing',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ? '✅ set' : '❌ missing',
  }
);

if (!databaseId) {
  throw new Error(
    'VITE_FIREBASE_DATABASE_ID is not set. ' +
    'Check your .env or Vercel environment variables.'
  );
}

console.log('[Firebase] Using database ID:', databaseId);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: any;
let auth: any;
let db: any;
let storage: any;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Initialize Firestore with explicit database ID and robust connection settings
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, databaseId);
  
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

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
    console.log(`[Firebase Diagnostics] Firestore DB ID: ${databaseId}`);
    
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
