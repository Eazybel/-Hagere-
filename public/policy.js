 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider , onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
 const firebaseConfig = {
    apiKey: "AIzaSyAXviVipDAJZl-xyiQE4JfACkcl1xt_CqM",
    authDomain: "hagere-c6abc.firebaseapp.com",
    projectId: "hagere-c6abc",
    storageBucket: "hagere-c6abc.firebasestorage.app",
    messagingSenderId: "272791886594",
    appId: "1:272791886594:web:05b9f9fd6fc98cdca3c01b"
  };
//VARIABLE AND FIREBASE INITIATER
  const app = initializeApp(firebaseConfig);
  const auth=getAuth(app)
  onAuthStateChanged(auth, (user) => {
  if (user) {
console.log("user found")
    const uid = user.uid;
    // ...
  } else {
fetch("/policyFetch",{method:"POST",body:JSON.stringify({"requestType":"singlePolicyFetch","policyID":localStorage.getItem("policyID")})}).then(res=>{return res.json()}).then(data=>
{
console.log(data)
})
  }
})
 


