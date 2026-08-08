import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider, getIdToken }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
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
 const provider=new GoogleAuthProvider()
const logInButton=document.getElementById("logInButton")
const captchaVerifyDiv=document.getElementById("captchaVerifyDiv")
const otpButton=document.getElementById("otpButton")
const otpInput=document.getElementById("otp-code")
logInButton.onclick=async()=>{
signInWithPopup(auth, provider)
  .then((result) => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;
    console.log(user

    )
    const idTokens=await getIdToken(user)
    console.log(idTokens)
   //NEW USER REGISTERING SYSTEM OR CHECKING USER AVAILABLITY
fetch("/newUserRegister",
      {
        method:"POST",
        headers:{"Content-type":"application/json","Authorization":`Bearer ${idTokens}`},
        body:JSON.stringify({"name":user.displayName,"email":user.email,"avatar":user.photoURL})
      }
    
    ).then(res=>{return res.json()}).then(data=>{console.log(data)})
    // window.location.href="./feed.html"
  }).catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
  
  });
}
