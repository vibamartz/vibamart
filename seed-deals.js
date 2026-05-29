// Fix for "Cannot use import statement outside a module"
// Run with: node seed-deals.js
require('dotenv').config();

async function run() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, doc, setDoc } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("Attempting to seed 'All Deals'...");
  try {
    await setDoc(doc(db, 'categories', 'all-deals'), {
      id: 'all-deals',
      name: 'All Deals',
      iconImage: '🔥',
      color: '#ef4444',
      order: -1,
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
      subcategories: []
    });
    console.log('Success! All Deals seeded.');
  } catch (error) {
    console.error('Error seeding data:', error.message);
    console.log('\nNOTE: If you got a "Permission Denied" error, it is because your Firestore rules require Admin authentication.');
    console.log('You DO NOT need to run this script! The website will automatically seed this category the next time an Admin opens the web app.');
  }
  process.exit(0);
}

run();
