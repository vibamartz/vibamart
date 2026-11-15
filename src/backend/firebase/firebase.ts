import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { doc, getDocFromServer, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

let firebaseConfig: any = {};
try {
  if (typeof process.env.FIREBASE_CONFIG === 'string') {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  } else if (process.env.FIREBASE_CONFIG) {
    firebaseConfig = process.env.FIREBASE_CONFIG;
  }
} catch (e) {
  firebaseConfig = {};
}

if (!firebaseConfig.projectId) {
  const pId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'viba-mart-app';
  firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyArTZAIiaESeahiK3Gdk5uUrru2U3WW9ww',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || `${pId}.firebaseapp.com`,
    projectId: pId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'viba-mart-app.firebasestorage.app',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '486981133317',
    appId: process.env.VITE_FIREBASE_APP_ID || '1:486981133317:web:4caa94260d5c2d18cb286c',
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-W3XVYZZEV4',
    ...firebaseConfig
  };
}

const app = initializeApp(firebaseConfig);

export let analytics: any = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Use initializeFirestore with settings to fix connectivity issues in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // @ts-ignore
  useFetchStreams: false,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export let messaging: Messaging | null = null;

export const getFcmMessaging = async (): Promise<Messaging | null> => {
  if (messaging) return messaging;
  if (typeof window !== 'undefined') {
    try {
      const supported = await isSupported();
      if (supported) {
        messaging = getMessaging(app);
        return messaging;
      }
    } catch (e) {
      console.warn("FCM messaging is not supported in this environment:", e);
    }
  }
  return null;
};


// Connectivity check
async function testConnection() {
  try {
    // Attempting to reach the server specifically
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection successful.");
  } catch (error) {
    console.error("Firestore connectivity error:", error);
    if (error instanceof Error && (error.message.includes("offline") || error.message.includes("10 seconds"))) {
      console.error("Please check your Firebase configuration or network. If you just set up Firebase, it might take a moment to provision.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow = true) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error("We couldn't complete this request right now. Please try again.");
  }
}
