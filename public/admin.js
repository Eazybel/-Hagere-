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
  const publishSpinner=document.getElementById("publishSpinner")
  const submitBtnText=document.getElementById("submitBtnText")
  const publishForm=document.getElementById("publishForm")
  const publishMessage=document.getElementById("publishMessage")
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
  if(submitBtn.disabled) return
  submitBtn.disabled=true
  submitBtn.setAttribute("aria-busy","true")
  submitBtnText.textContent="Publishing…"
  publishSpinner.classList.remove("hidden")
  publishMessage.classList.add("hidden")
  try{
    const form=new FormData(publishForm)
    const token=await auth.currentUser.getIdToken()
    const res=await fetch("/policyUpdate",{
      method:"POST",
      headers:{"Authorization":`Bearer ${token}`},
      body:form
    })
    const data=await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data.error || data.message || "Policy publishing failed")
    publishMessage.textContent="Policy published successfully"
    publishMessage.className="text-green-700"
    console.log(data)
    adminDataFetcher().catch(error=>console.error("Admin metrics refresh failed:",error))
  }catch(error){
    publishMessage.textContent=error.message || "Policy publishing failed"
    publishMessage.className="text-red-700"
    console.error(error)
  }finally{
    submitBtn.disabled=false
    submitBtn.removeAttribute("aria-busy")
    submitBtnText.textContent="Publish Post"
    publishSpinner.classList.add("hidden")
  }
  publishMessage.classList.remove("hidden")
}
// POLICY NUMBER UPDATE
const adminDataFetcher=async()=>{
  const token=await user.getIdToken()
  const headers={"Authorization":`Bearer ${token}`}
  const [policyResponse,userResponse]=await Promise.all([
    fetch("/admin/policyCount",{headers,cache:"no-store"}),
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
 
