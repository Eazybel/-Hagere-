 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider , onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
  const firebaseConfig = {
   apiKey: "AIzaSyBg9v5J4qdDYQhYCl79Q1U5Nm7hzrQ7yMw",
  authDomain: "hagere-admin.firebaseapp.com",
  projectId: "hagere-admin",
  storageBucket: "hagere-admin.firebasestorage.app",
  messagingSenderId: "907064312662",
  appId: "1:907064312662:web:e716e0df19627c4a5dccf7"
  };
//VARIABLE AND FIREBASE INITIATER
  const app = initializeApp(firebaseConfig);
  const auth=getAuth(app)
  const publishModal=document.getElementById("publishModal")
  const publishBtn=document.getElementById("publishBtn")
  const cancelBtn=document.getElementById("cancelBtn")
  const submitBtn=document.getElementById("submitBtn")
  const publishForm=document.getElementById("publishForm")
  onAuthStateChanged(auth, (user) => {
  if (user) {
    // MODAL OOPENER AND CLOSER
 publishBtn.onclick=async()=>{
    publishModal.classList.remove("hidden")
    document.querySelector("main").classList.add("hidden")
  }
  cancelBtn.onclick=()=>{
    document.querySelector("main").classList.remove("hidden")
    window.location.href=("./admin.html")

  }
// SUBMIT HANDLER
submitBtn.onclick=(e)=>{
  e.preventDefault()
  const form=new FormData(publishForm)
  const objectedForm=Object.fromEntries(form.entries())
  fetch("/policyUpdate",{
    method:"POST",
    body:form
  }).then(res=>{return res.json()}).then(data=>{console.log(data)})
}
    const uid = user.uid;
    // ...
  } else {
console.log("user is not signed up")
  }
})
 


