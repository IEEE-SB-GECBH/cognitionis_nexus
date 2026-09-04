import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApVnO_GTXbuiBpsDRGI0n3DvoPIen3rlA",
  authDomain: "ieee-cognitionisnexus.firebaseapp.com",
  projectId: "ieee-cognitionisnexus",
  storageBucket: "ieee-cognitionisnexus.firebasestorage.app",
  messagingSenderId: "535276655152",
  appId: "1:535276655152:web:9c43e7326d516fcd1313f5",
  measurementId: "G-ZDZ3NHC4VL"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);