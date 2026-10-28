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
submitBtn.onclick=async(e)=>{
  e.preventDefault()
  const form=new FormData(publishForm)
  const token=await auth.currentUser.getIdToken()
  fetch("/policyUpdate",{
    method:"POST",
    headers:{"Authorization":`Bearer ${token}`},
    body:form
  }).then(async res=>{
    if(!res.ok) throw new Error("Policy publishing failed")
    return res.json()
  }).then(data=>{console.log(data)}).catch(error=>console.error(error))
}
// POLICY NUMBER UPDATE
const adminDataFetcher=async()=>{
  const token=await user.getIdToken()
  const headers={"Authorization":`Bearer ${token}`}
  const [policyResponse,userResponse]=await Promise.all([
    fetch("/admin/policyCount",{headers}),
    fetch("/userFetch",{method:"POST",headers,body:JSON.stringify({requestType:"userNumberFetch"})})
  ])
  if(!policyResponse.ok || !userResponse.ok) throw new Error("Unable to load admin metrics")
  const [policyData,userData]=await Promise.all([policyResponse.json(),userResponse.json()])
  document.querySelector(".activePolicy").innerText=policyData.count
  document.querySelector(".activeCitizens").innerText=userData.count
}
adminDataFetcher().catch(error=>console.error(error))
    const uid = user.uid;
    // ...
  } else {
console.log("user is not signed up")
  }
})
 

