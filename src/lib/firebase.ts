import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, query, collection, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Safely attempt to load the local config file if it exists. 
// Using import.meta.glob avoids build errors when the file is missing in production (Vercel).
const configs = import.meta.glob('../../firebase-applet-config.json', { eager: true, import: 'default' });
const firebaseConfigJson = (Object.values(configs)[0] || {}) as any;

/**
 * Firebase Configuration
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId || '(default)';

// Initialize Firebase
let app: any;
try {
  if (!firebaseConfig.apiKey) {
    throw new Error('Missing Firebase API Key. Did you forget to set environment variables?');
  }
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.error('[Firebase] Initialization failed. Ensure environment variables are set.', error);
}

// Proxies to delay crashing until the component actually uses the library
const getSafeService = (serviceFactory: any, ...args: any[]) => {
  try {
    return app ? serviceFactory(app, ...args) : null;
  } catch (e) {
    return null;
  }
};

const auth = getSafeService(getAuth) as ReturnType<typeof getAuth>;
const db = getSafeService(getFirestore, databaseId) as ReturnType<typeof getFirestore>;
const storage = getSafeService(getStorage) as ReturnType<typeof getStorage>;

export { app, auth, db, storage };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
if (import.meta.env.DEV) {
  // We don't need to manually call it here as it's called inside initFirebase
}

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase Auth is not initialized. Please check Environment Variables.");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};
