import dotenv from 'dotenv';
dotenv.config();
import admin from 'firebase-admin';

let key = process.env.FIREBASE_PRIVATE_KEY || '';
key = key.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
console.log('Key length:', key.length);
try {
  const cred = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: key,
  });
  console.log('Cert parsed successfully!');
} catch (e) {
  console.log('Cert parse error:', e.message);
}
