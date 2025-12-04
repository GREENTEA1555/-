// firebaseConfig.tsx
import { initializeApp, getApps, getApp } from "firebase/app"; //
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAFQlRKhhlrUyjoV61tQhypwBWnq7XZywU",
  authDomain: "engineers246.firebaseapp.com",
  projectId: "engineers246",
  storageBucket: "engineers246.firebasestorage.app",
  messagingSenderId: "238927675352",
  appId: "1:238927675352:web:0de22323f20b51058a3cad",
  measurementId: "G-QYGL0N16Q8"
};

// 修正：先檢查是否已經有 App 存在，有就拿舊的，沒有才建立新的
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };