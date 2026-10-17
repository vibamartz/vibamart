import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

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

async function checkCategories() {
  const snap = await getDocs(collection(db, 'categories'));
  console.log(`Found ${snap.docs.length} categories in Firestore`);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`- Category [${d.id}]: name="${data.name}", image=${(data.image || '').substring(0, 50)}...`);
    if (data.subcategories && data.subcategories.length > 0) {
      data.subcategories.forEach(sub => {
        console.log(`    - Sub [${sub.id}]: name="${sub.name}", image=${(sub.image || '').substring(0, 50)}...`);
        if (sub.subcategories && sub.subcategories.length > 0) {
          sub.subcategories.forEach(n => {
            console.log(`        - Nested [${n.id}]: name="${n.name}", image=${(n.image || '').substring(0, 50)}...`);
          });
        }
      });
    }
  });
}

checkCategories().then(() => process.exit(0)).catch(err => {
  console.error('Error fetching categories:', err);
  process.exit(1);
});
