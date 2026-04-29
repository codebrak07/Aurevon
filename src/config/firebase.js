import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCthoqLTEiuJMs8rlqpz5vEjja8Xlapd5A",
  authDomain: "aurevon-07.firebaseapp.com",
  projectId: "aurevon-07",
  storageBucket: "aurevon-07.firebasestorage.app",
  messagingSenderId: "726680656800",
  appId: "1:726680656800:web:f14b0bca20d563fc8de2c5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, signInWithCustomToken };
