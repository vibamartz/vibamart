import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { doc, getDocFromServer, initializeFirestore, getFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyArTZAIiaESeahiK3Gdk5uUrru2U3WW9ww",
  authDomain: "viba-mart-app.firebaseapp.com",
  projectId: "viba-mart-app",
  storageBucket: "viba-mart-app.firebasestorage.app",
  messagingSenderId: "486981133317",
  appId: "1:486981133317:web:4caa94260d5c2d18cb286c",
  measurementId: "G-W3XVYZZEV4"
};

let activeConfig = { ...firebaseConfig };
try {
  let envConfig: any = {};
  if (typeof process.env.FIREBASE_CONFIG === 'string') {
    envConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  } else if (process.env.FIREBASE_CONFIG) {
    envConfig = process.env.FIREBASE_CONFIG;
  }
  if (envConfig && typeof envConfig === 'object') {
    for (const [key, val] of Object.entries(envConfig)) {
      if (val && typeof val === 'string' && !val.includes('your_') && !val.includes('placeholder')) {
        (activeConfig as any)[key] = val;
      }
    }
  }
} catch (e) {
  // Use fallback configuration
}

const envApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
if (envApiKey && !envApiKey.includes('your_')) activeConfig.apiKey = envApiKey;

const envAuthDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN;
if (envAuthDomain && !envAuthDomain.includes('your_')) activeConfig.authDomain = envAuthDomain;

const envProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
if (envProjectId && !envProjectId.includes('your_') && envProjectId !== 'viba-mart-f46a4') activeConfig.projectId = envProjectId;

const envStorageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
if (envStorageBucket && !envStorageBucket.includes('your_')) activeConfig.storageBucket = envStorageBucket;

const envSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID;
if (envSenderId && envSenderId !== '1083492847291') activeConfig.messagingSenderId = envSenderId;

const envAppId = process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID;
if (envAppId && !envAppId.includes('your_') && !envAppId.includes('viba1234567890')) activeConfig.appId = envAppId;

const envMeasurementId = process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID;
if (envMeasurementId) activeConfig.measurementId = envMeasurementId;

// Prevent duplicate Firebase initialization
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(activeConfig);

// Initialize Firebase Analytics safely so it never interrupts Login, Signup, or UI flows if unavailable
export let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (err) {
          console.warn("[Firebase] Analytics initialization skipped:", err);
        }
      }
    })
    .catch((err) => {
      console.warn("[Firebase] Analytics is not supported in this environment:", err);
    });
}

export const getFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (analytics) return analytics;
  if (typeof window !== 'undefined') {
    try {
      const supported = await isAnalyticsSupported();
      if (supported) {
        analytics = getAnalytics(app);
        return analytics;
      }
    } catch (e) {
      console.warn("[Firebase] Analytics not supported:", e);
    }
  }
  return null;
};

// Use initializeFirestore with settings to fix connectivity issues in restricted environments,
// or reuse existing Firestore instance to prevent duplicate initialization
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    // @ts-ignore
    useFetchStreams: false,
  }, (activeConfig as any).firestoreDatabaseId);
} catch (e) {
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

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


// Connectivity check (client-side only, non-blocking)
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    // Attempting to reach the server specifically
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error && (error.message.includes("offline") || error.message.includes("10 seconds") || error.message.includes("PERMISSION_DENIED"))) {
      console.warn("Firestore connectivity notice: operating with client resilience.");
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
