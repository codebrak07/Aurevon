const admin = require('firebase-admin');

let auth = {
  createCustomToken: async () => { 
    console.warn('[Firebase Mock] createCustomToken called but Firebase not initialized');
    return null; 
  }
};
let db = {
  collection: () => ({
    doc: () => ({
      set: async () => { console.warn('[Firebase Mock] Firestore set called but Firebase not initialized'); },
      get: async () => ({ exists: false, data: () => ({}) }),
      update: async () => {},
      onSnapshot: () => (() => {}),
      where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) })
    })
  })
};

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID || 'aurevon-07',
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'aurevon-07.firebasestorage.app',
        });
      }
      db = admin.firestore();
      auth = admin.auth();
      console.log('✅ [Firebase Admin] Initialized with Service Account from ENV');
    } catch (err) {
      console.error('❌ [Firebase Admin] Failed to initialize with ENV Service Account:', err.message);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'aurevon-07',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'aurevon-07.firebasestorage.app',
      });
    }
    db = admin.firestore();
    auth = admin.auth();
    console.log('✅ [Firebase Admin] Initialized with Service Account File');
  } else {
    console.warn('⚠️ [Firebase Admin] GOOGLE_APPLICATION_CREDENTIALS not found. Running with Mocks.');
  }
} catch (error) {
  console.error('❌ [Firebase Admin] Initialization Error:', error.message);
}

module.exports = { admin, db, auth };
