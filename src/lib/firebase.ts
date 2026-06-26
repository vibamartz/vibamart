import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// @ts-ignore
const firebaseConfig = process.env.FIREBASE_CONFIG || {};

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with settings to fix connectivity issues in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // @ts-ignore
  useFetchStreams: false,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

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
    throw new Error(JSON.stringify(errInfo));
  }
}
