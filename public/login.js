/**
 * @file login.js
 * @description Handles citizen Google sign-in, server-side profile registration, and accessible loading/error feedback.
 * @module Client/Authentication
 * @requires Firebase Auth browser SDK and local firebaseInit.js
 */
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"
import { auth } from "./firebaseInit.js"

// DOM references and provider configuration are module-level state for the sign-in interaction.
const signInButton=document.getElementById("logInButton")
const signInButtonText=document.getElementById("loginButtonText")
const signInSpinner=document.getElementById("loginSpinner")
const signInLogo=signInButton.querySelector("svg")
const errorMessage=document.getElementById("loginError")
const provider=new GoogleAuthProvider()
provider.setCustomParameters({prompt:"select_account"})

/** @listens click Completes Firebase sign-in, then registers/synchronizes the profile using a Bearer ID token. */
// User gesture triggers Firebase popup auth; the resulting ID token is sent to profile registration.
signInButton.addEventListener("click",async()=>{
    // Disable repeat submissions and expose progress before starting external authentication.
    signInButton.disabled=true
    signInButton.setAttribute("aria-busy","true")
    signInButtonText.textContent="Signing in..."
    signInSpinner.classList.remove("hidden")
    signInLogo.classList.add("hidden")
    errorMessage.classList.add("hidden")
    errorMessage.textContent=""

    try{
        // Firebase authenticates the citizen; the server verifies the ID token before profile persistence.
        const result=await signInWithPopup(auth,provider)
        const token=await result.user.getIdToken(true)
        const response=await fetch("/newUserRegister",{
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                "Authorization":`Bearer ${token}`
            },
            body:JSON.stringify({
                name:result.user.displayName,
                avatar:result.user.photoURL
            })
        })
        const payload=await response.json().catch(()=>({}))
        if(!response.ok || payload.success!==true){
            throw new Error(payload.error || `Account setup failed (${response.status})`)
        }
        window.location.assign("./feed.html")
    }catch(error){
        console.error("Citizen sign-in failed:",error)
        errorMessage.textContent=error.message || "Unable to sign in. Please try again."
        errorMessage.classList.remove("hidden")
    }finally{
        // Restore the button regardless of popup, API, or validation failure.
        signInButton.disabled=false
        signInButton.removeAttribute("aria-busy")
        signInButtonText.textContent="Continue with Google"
        signInSpinner.classList.add("hidden")
        signInLogo.classList.remove("hidden")
    }
})
