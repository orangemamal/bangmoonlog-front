import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration (Hardcoded for easy deployment)
const firebaseConfig = {
  apiKey: "AIzaSyCStgKsQCZb8kJucanxCF0aanKZkM13HpE",
  authDomain: "bangmoonlog-bdf9a.firebaseapp.com",
  projectId: "bangmoonlog-bdf9a",
  storageBucket: "bangmoonlog-bdf9a.firebasestorage.app",
  messagingSenderId: "710804951424",
  appId: "1:710804951424:web:eb09a6f70908b501c5f165",
  measurementId: "G-XNJX23Y2MP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
