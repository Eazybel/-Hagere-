import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider , onAuthStateChanged }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
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
onAuthStateChanged(auth, (user) => {
  if (user) {
  window.location.replace("/feed.html")
    const uid = user.uid;
    // ...
  } else {

        // POLICY POST UPDATER
fetch("/policyFetch",{method:"POST",body:JSON.stringify({"requestType":"policyDataFetch"})}).then(res=>{return res.json()}).then(data=>
{
    const policySection=document.getElementById("policySection")
    if(data.length<1){
policySection.insertAdjacentHTML("beforeend",`<div class="col-span-full py-12 text-center bg-antique-card border border-antique-border rounded-lg font-sans">
    <p class="text-antique-muted text-sm">No Policies Posted Yet.</p>
</div>`)
    }else if(data.length>1){

          
  data.forEach(policy=>{
    policySection.insertAdjacentHTML("beforeend",
      `
           <article class="bg-antique-card border border-antique-border rounded-lg p-6 flex flex-col justify-between">
    <div>
        <div class="flex items-center justify-between text-xs font-sans text-antique-muted mb-2">
            <span class="uppercase tracking-wider px-2 py-0.5 bg-antique-bg border border-antique-border rounded category">${policy.category}</span>
            <span>Published: ${new Date(policy.createdAt).toLocaleString()}</span>
        </div>
        <h2 class="text-xl font-bold mb-2 title">
            ${policy.title}
        </h2>
        <p class="text-sm text-antique-muted font-sans mb-4 line-clamp-4">
            ${policy.summary}
        </p>
    </div>

    <div>
        <!-- Vote Counts Breakdown Analytics -->
        <div class="mb-4 pt-2 border-t border-antique-border font-sans text-xs flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center space-x-3 text-antique-muted">
                <span>Agree: <strong class="text-antique-text">923</strong></span>
                <span>Neutral: <strong class="text-antique-text">142</strong></span>
                <span>Disagree: <strong class="text-antique-text">355</strong></span>
            </div>
            <span class="text-antique-muted">Comments: <strong class="text-antique-text">48</strong></span>
        </div>

        <!-- Action Link to Vote, Read & Comment -->
        <div class="pt-3 border-t border-antique-border font-sans flex items-center justify-between">
            <span class="text-xs text-antique-muted">Explore full policy document & discussions</span>
            <button type="button" class="px-4 py-2 bg-antique-accent text-white rounded text-xs font-medium hover:bg-antique-accentHover transition-colors shadow-sm inline-block policyRedirectBtn">
                Read, Vote & Comment &rarr;
            </button>
            <label class="hidden idLabel">${policy._id}</label>
        </div>
    </div>
</article>
      `
    )
  })
return data
    }

}

).then((data)=>{
        // FILTERING SECTION CODE BLOCK
  const titleFilter=document.getElementById("titleFilter")
titleFilter.onkeydown=(e)=>{
    const target=e.target.value.toLowerCase()
    let titleText=document.querySelectorAll(".title")
    titleText.forEach(titles=>{
     const titleLower=titles.innerText.toLowerCase()
    if(!titleLower.includes(target)){
        titles.parentElement.parentElement.style.display="none"
        
    }else if(titleLower.includes(target)){
    titles.parentElement.parentElement.style.display=""
    }else{
policySection.insertAdjacentHTML("beforeend",`<div class="col-span-full py-12 text-center bg-antique-card border border-antique-border rounded-lg font-sans">
    <p class="text-antique-muted text-sm">No Policies Posted Yet.</p>
</div>`)
}
    })
    
}
// CATEGORY FILTER SECTION
const policySection=document.getElementById("policySection")
const catagoryFilter=document.getElementById("policy-category")
const categoryLabel=document.querySelectorAll(".category")
catagoryFilter.addEventListener("change",(e)=>{
  const targetValue=e.target.value.toLowerCase()
categoryLabel.forEach(label=>{
 const labelToLower=label.innerText.trim().toLowerCase()
 if(targetValue=="all major sectors"){
label.closest("article").style.display=""

 }else if(labelToLower==targetValue){

label.closest("article").style.display=""
}else if(labelToLower!=targetValue){
label.closest("article").style.display="none"
}
})
})
// POLICY REDIRECT SECTION
const policyRedirectBtn=document.querySelectorAll(".policyRedirectBtn")
policyRedirectBtn.forEach(redirect=>{
    redirect.onclick=()=>{
       const idLabel=redirect.parentElement.querySelector(".idLabel").innerText
      localStorage.setItem("policyID",idLabel)
      window.location.href="./policy.html"
    }
})

})
 document.querySelector("body").classList.remove("hidden")
  }
});