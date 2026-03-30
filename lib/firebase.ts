import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAY7zIdBaNRcKC6rBdvISwwCyJEA4THix8",
  authDomain: "fur-dentity.firebaseapp.com",
  databaseURL: "https://fur-dentity-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fur-dentity",
  storageBucket: "fur-dentity.firebasestorage.app",
  messagingSenderId: "735747832984",
  appId: "1:735747832984:web:11177033e179a5f93924ed",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export { RecaptchaVerifier, signInWithPhoneNumber };
