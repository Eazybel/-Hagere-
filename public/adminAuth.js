/**
 * @file adminAuth.js
 * @description Signs administrators in with the dedicated Firebase project and checks server-side admin authorization.
 * @module Client/AdminAuthentication
 * @requires Firebase App and Auth browser SDKs
 */
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
// The admin Firebase project is distinct from the citizen project; the backend also checks ADMIN_UIDS.
const auth=getAuth(initializeApp(firebaseConfig))
// Cached DOM references for login form fields, status, and submit progress.
const signInButton=document.getElementById("logInBtn")
const signInButtonText=document.getElementById("adminLoginButtonText")
const signInSpinner=document.getElementById("adminLoginSpinner")
const emailInput=document.getElementById("adminEmail")
const passwordInput=document.getElementById("adminPassword")
const errorMessage=document.getElementById("errorMessage")

/** @listens submit Authenticates credentials and confirms admin role by requesting a protected endpoint. */
// Credentials stay within Firebase Auth; the resulting ID token is checked against a protected backend endpoint.
document.getElementById("adminLoginForm").addEventListener("submit",async event=>{
    event.preventDefault()
    signInButton.disabled=true
    signInButton.setAttribute("aria-busy","true")
    signInButtonText.textContent="Signing in..."
    signInSpinner.classList.remove("hidden")
    errorMessage.classList.add("hidden")
    errorMessage.textContent=""

    // Keep progress visible and prevent duplicate authentication requests.
    try{
        const credential=await signInWithEmailAndPassword(
            auth,
            emailInput.value.trim(),
            passwordInput.value
        )
        // Send the Firebase ID token; the API independently verifies project and UID authorization.
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
        // Re-enable login after both successful navigation and handled failures.
        signInButton.disabled=false
        signInButton.removeAttribute("aria-busy")
        signInButtonText.textContent="Sign In as Admin"
        signInSpinner.classList.add("hidden")
    }
})
