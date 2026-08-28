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
// VARIABLE INITIATION FOR DOM AND OTHER
const signOutButton=document.getElementById("signOutButton")
const userInfoSection=document.getElementById("userInfoSection")
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth=getAuth(app)
onAuthStateChanged(auth, (user) => {
  if (user) {
document.querySelector("body").classList.remove("hidden")
    const uid = user.uid;
    // ...
  //  if(user.phoneNumber){
  //   userInfoSection.insertAdjacentHTML("beforeend",
  //     `
  //     <div>
  //               <div class="flex items-center space-x-3 mb-1">
  //                   <h1 class="text-2xl font-normal">Citizen Profile & Activity</h1>
  //                   <span class="px-2 py-0.5 bg-antique-bg border border-antique-border rounded text-xs font-sans text-emerald-700 font-medium">Verified Resident</span>
  //               </div>
  //               <p class="text-sm text-antique-muted font-sans">
  //                   Phone Number: +251 9••••••44 &bull; Member Since: May 2026
  //               </p>
  //           </div>
  //     `
  //   )
  //  }else{
  //   userInfoSection.insertAdjacentHTML("beforebegin",
  //     `
  //     <div>
  //               <div class="flex items-center space-x-3 mb-1">
  //                   <h1 class="text-2xl font-normal">Citizen Profile & Activity</h1>
  //                   <span class="px-2 py-0.5 bg-antique-bg border border-antique-border rounded text-xs font-sans text-red-700 font-medium">Not Verified </span>
  //               </div>
  //               <p class="text-sm text-antique-muted font-sans">
  //                   Phone Number: (add phone number to your google account to verify) &bull; Member Since: May 2026
  //               </p>
  //           </div>
  //     `
  //   )
  //  }
  } else {
window.location.href="./login.html"
  }
});
signOutButton.onclick=()=>{
  signOut(auth).then(() => {
    window.location.href("./index.html")
}).catch((error) => {
  console.log(error)
});
}