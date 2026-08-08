import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
  const firebaseConfig = {
    apiKey: "AIzaSyBg9v5J4qdDYQhYCl79Q1U5Nm7hzrQ7yMw",
    authDomain: "hagere-admin.firebaseapp.com",
    projectId: "hagere-admin",
    storageBucket: "hagere-admin.firebasestorage.app",
    messagingSenderId: "907064312662",
    appId: "1:907064312662:web:e716e0df19627c4a5dccf7"
  };
  const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// VARIABLE INITIATION
const logInBtn=document.getElementById("logInBtn")
const adminEmail=document.getElementById("adminEmail")
const adminPassword=document.getElementById("adminPassword")
logInBtn.onclick=()=>{
const email=adminEmail.value
const password=adminPassword.value
    signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed in 
    const user = userCredential.user;
 window.location.href="./admin.html"
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
     alert("Incorrect Credential Used")
  });
}