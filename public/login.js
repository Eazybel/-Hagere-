  import { initializeApp,getAuth } from "firebase/auth";
  const firebaseConfig = {
    apiKey: "AIzaSyAXviVipDAJZl-xyiQE4JfACkcl1xt_CqM",
    authDomain: "hagere-c6abc.firebaseapp.com",
    projectId: "hagere-c6abc",
    storageBucket: "hagere-c6abc.firebasestorage.app",
    messagingSenderId: "272791886594",
    appId: "1:272791886594:web:05b9f9fd6fc98cdca3c01b"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
const auth=getAuth(app)
const logInButton=document.getElementById("logInButton")
const captchaVerifyDiv=document.getElementById("captchaVerifyDiv")
const otpButton=document.getElementById("otpButton")
const otpInput=document.getElementById("otp-code")
logInButton.onclick=()=>{
    const phoneNumberInput=document.getElementById("phone-number").value
    console.log(phoneNumberInput)
}
const render=()=>{
    window.recaptchaVerifier=new firebaseConfig.auth.RecaptchaVerifier("captchaVerifyDiv")
    recaptchaVerifier.render()
}
render()