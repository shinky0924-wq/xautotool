import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0387396648",
  appId: "1:438817036932:web:c95cff77041170f0c7c0d1",
  apiKey: "AIzaSyAljik7pZqm5Hdd9Uts0AUyL8K5ttGcdaM",
  authDomain: "gen-lang-client-0387396648.firebaseapp.com",
  storageBucket: "gen-lang-client-0387396648.firebasestorage.app",
  messagingSenderId: "438817036932",
};

const app = initializeApp(firebaseConfig);

// Using the custom database ID provided in firebase-applet-config.json
export const db = initializeFirestore(app, {}, "ai-studio-remixxrecruitmen-93ff843d-c86c-4a45-959c-dc85651f0848");
