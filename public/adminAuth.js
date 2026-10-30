import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js"
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"

const firebaseConfig={
    apiKey:"AIzaSyBg9v5J4qdDYQhYCl79Q1U5Nm7hzrQ7yMw",
    authDomain:"hagere-admin.firebaseapp.com",
    projectId:"hagere-admin",
    storageBucket:"hagere-admin.firebasestorage.app",
    messagingSenderId:"907064312662",
    appId:"1:907064312662:web:e716e0df19627c4a5dccf7"
}
const auth=getAuth(initializeApp(firebaseConfig))
const signInButton=document.getElementById("logInBtn")
const emailInput=document.getElementById("adminEmail")
const passwordInput=document.getElementById("adminPassword")
const errorMessage=document.getElementById("errorMessage")

document.getElementById("adminLoginForm").addEventListener("submit",async event=>{
    event.preventDefault()
    signInButton.disabled=true
    errorMessage.classList.add("hidden")
    errorMessage.textContent=""

    try{
        const credential=await signInWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        )
        const token=await credential.user.getIdToken(true)
        const response=await fetch("/admin/policyCount",{
            headers:{Authorization:`Bearer ${token}`},
            cache:"no-store"
        })
        const payload=await response.json().catch(()=>({}))
        if(!response.ok){
            throw new Error(payload.error || payload.message || `Admin access denied (${response.status})`)
        }
        window.location.assign("./admin.html")
    }catch(error){
        console.error("Admin sign-in failed:",error)
        const messages={
            "auth/invalid-credential":"Email or password is incorrect.",
            "auth/invalid-email":"Enter a valid email address.",
            "auth/user-disabled":"This administrator account is disabled.",
            "auth/too-many-requests":"Too many attempts. Please wait and try again."
        }
        errorMessage.textContent=messages[error.code]
            || error.message
            || "Unable to sign in. Please try again."
        errorMessage.classList.remove("hidden")
    }finally{
        signInButton.disabled=false
    }
})
