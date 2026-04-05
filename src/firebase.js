import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCNzHZQVYG14hycFVdyKwveQMeA1uj69TY",
    authDomain: "ecobuddy-30bcd.firebaseapp.com",
    projectId: "ecobuddy-30bcd",
    storageBucket: "ecobuddy-30bcd.firebasestorage.app",
    messagingSenderId: "862112140812",
    appId: "1:862112140812:web:3dc4d1a3aa37da2a566829",
    measurementId: "G-1RDFNT7K87"
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);