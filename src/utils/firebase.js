import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Configurazione Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyAd7n_WQD_jUUPSTftZ6jtu8xidMun-jzc",
  authDomain: "sbd-ladder.firebaseapp.com",
  databaseURL: "https://sbd-ladder-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sbd-ladder",
  storageBucket: "sbd-ladder.appspot.com",
  messagingSenderId: "111032615204",
  appId: "1:111032615204:web:c444cf45e5bd5733adb3b1",
  measurementId: "G-GCFF96NMEW"
};

// Inizializza Firebase una sola volta per tutta l'app
const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);

export const normalizeUsername = (value = '') => value.toLowerCase().replace(/\s/g, '');
