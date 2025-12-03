// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAFQlRKhhlrUyjoV61tQhypwBWnq7XZywU",
  authDomain: "engineers246.firebaseapp.com",
  projectId: "engineers246",
  storageBucket: "engineers246.firebasestorage.app",
  messagingSenderId: "238927675352",
  appId: "1:238927675352:web:0de22323f20b51058a3cad",
  measurementId: "G-QYGL0N16Q8"
};

// Initialize Firebase
// 加入防止重複初始化的檢查
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  // 如果已經初始化過，就忽略錯誤
}
const db = getFirestore(app);

export { db };