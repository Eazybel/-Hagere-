import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"
import { auth } from "./firebaseInit.js"

const signInButton=document.getElementById("logInButton")
const errorMessage=document.getElementById("loginError")
const provider=new GoogleAuthProvider()
provider.setCustomParameters({prompt:"select_account"})

signInButton.addEventListener("click",async()=>{
    signInButton.disabled=true
    errorMessage.classList.add("hidden")
    errorMessage.textContent=""

    try{
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
        signInButton.disabled=false
    }
})
