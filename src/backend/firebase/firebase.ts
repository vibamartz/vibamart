import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

// @ts-ignore
const firebaseConfig = process.env.FIREBASE_CONFIG || {};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with default fast transport
export const db = initializeFirestore(app, {}, (firebaseConfig as any).firestoreDatabaseId);

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
