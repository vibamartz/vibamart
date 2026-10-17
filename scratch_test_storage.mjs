import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';

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
const storage = getStorage(app);

async function testStorage() {
  const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testRef = ref(storage, 'images/subcategories/test-test12.png');
  try {
    await uploadString(testRef, dummyDataUrl, 'data_url', { contentType: 'image/png' });
  } catch (err) {
    console.log('Error properties:', Object.keys(err));
    console.log('Server response:', err.serverResponse);
    console.log('Status code:', err.status_);
    console.log('Custom data:', err.customData);
  }
}

testStorage().then(() => process.exit(0));
