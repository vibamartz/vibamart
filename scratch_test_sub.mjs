import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const pId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'viba-mart-f46a4';
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || `${pId}.firebaseapp.com`,
  projectId: pId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || `${pId}.appspot.com`,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1083492847291',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

async function testSubcategorySave() {
  const catRef = doc(db, 'categories', '1');
  const catSnap = await getDoc(catRef);
  const cat = catSnap.data();
  console.log('Category name:', cat.name);
  console.log('Subcategories count:', cat.subcategories.length);
  const sampleSub = cat.subcategories[0];
  console.log('Subcategory 0 before:', sampleSub.name, sampleSub.image?.substring(0, 40));
}

testSubcategorySave().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
