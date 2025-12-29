import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD7d7d3DI5ZHhUmq132Yf9FQYmTNAPoLRE",
    authDomain: "couple-32bb8.firebaseapp.com",
    projectId: "couple-32bb8",
    storageBucket: "couple-32bb8.firebasestorage.app",
    messagingSenderId: "658887166900",
    appId: "1:658887166900:web:c37927aef83e113911c0e1",
    measurementId: "G-P9D2VV566S"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
