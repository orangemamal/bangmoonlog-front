import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// Your web app's Firebase configuration (Hardcoded for easy deployment)
const firebaseConfig = {
  apiKey: "AIzaSyCStgKsQCStgKsQCStgKsQCStgKsQC",
  authDomain: "bangmoonlog-front.firebaseapp.com",
  projectId: "bangmoonlog-front",
  storageBucket: "bangmoonlog-front.firebasestorage.app",
  messagingSenderId: "483483483483",
  appId: "1:483483483483:web:786786786786",
  measurementId: "G-XNJX23Y2MP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
