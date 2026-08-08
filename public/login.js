import {auth} from "./firebaseInit"
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
 const provider=new GoogleAuthProvider()
const logInButton=document.getElementById("logInButton")
const captchaVerifyDiv=document.getElementById("captchaVerifyDiv")
const otpButton=document.getElementById("otpButton")
const otpInput=document.getElementById("otp-code")
logInButton.onclick=()=>{
const phoneNumberInput=document.getElementById("phone-number").value

signInWithPopup(auth, provider)
  .then((result) => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;
    windwow.location.href="./feed.html"
  }).catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    const email = error.customData.email;
    const credential = GoogleAuthProvider.credentialFromError(error);
  
  });
}
