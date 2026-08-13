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
  const commentPostSection=document.getElementById("commentPostSection")
  onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    // POLICY ARTICLE RENDERING SECTION
      const policyArticle=document.getElementById("policyArticle")
fetch("/policyFetch",{method:"POST",body:JSON.stringify({"requestType":"singlePolicyFetch","policyID":localStorage.getItem("policyID")})}).then(res=>{return res.json()}).then(data=>
{
policyArticle.insertAdjacentHTML("beforeend",
    `
   <div>
            
            <!-- Metadata Header -->
            <div class="flex flex-wrap items-center justify-between text-xs font-sans text-antique-muted mb-4 pb-4 border-b border-antique-border gap-2">
                <span class="uppercase tracking-wider px-2.5 py-1 bg-antique-bg border border-antique-border rounded font-medium text-antique-text">${data.category}</span>
                <span id="publishDate">Published on ${new Date(data.createdAt).toLocaleString()} &bull; Status: Active Public Consultation</span>
            </div>

            <!-- Title & Full Description -->
            <h1 class="text-2xl md:text-3xl font-normal mb-6 leading-snug">${data.title}</h1>
            
            <div class="space-y-4 text-sm text-antique-text font-sans leading-relaxed mb-6">
                <p>
                     ${data.summary}
                </p>

            </div>

            <!-- View Full Policy Document Link -->
            <div class="mb-8 font-sans">
                <a href=" ${data.pdfUrl}" target="_blank" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-antique-bg border border-antique-border rounded-lg text-xs font-medium text-antique-accent hover:bg-antique-border transition-colors shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span>View Full Policy Document (PDF) &rarr;</span>
                </a>
            </div>

            <!-- Aggregate Stance Distribution (No Coloring) -->
            <div class="mb-6 p-4 bg-antique-bg border border-antique-border rounded-lg font-sans text-xs">
                <span class="block text-antique-muted uppercase tracking-wider mb-2 font-semibold">Aggregate Public Stance (1,420 Total Votes)</span>
                <div class="flex flex-wrap items-center gap-6 text-sm">
                    <span>Agree: <strong class="text-antique-text">923</strong></span>
                    <span>Neutral: <strong class="text-antique-text">142</strong></span>
                    <span>Disagree: <strong class="text-antique-text">355</strong></span>
                </div>
            </div>

            <!-- Voting Interaction Section -->
            <form class="pt-6 border-t border-antique-border font-sans flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-xs text-antique-muted font-medium uppercase tracking-wider">Cast or Update Your Stance:</div>
                <div class="flex items-center space-x-6 text-sm">
                    <label class="flex items-center space-x-1.5 cursor-pointer">
                        <input type="radio" name="policy-vote" value="agree" class="accent-antique-accent">
                        <span>Agree</span>
                    </label>
                    <label class="flex items-center space-x-1.5 cursor-pointer">
                        <input type="radio" name="policy-vote" value="neutral" class="accent-antique-accent">
                        <span>Neutral</span>
                    </label>
                    <label class="flex items-center space-x-1.5 cursor-pointer">
                        <input type="radio" name="policy-vote" value="disagree" class="accent-antique-accent">
                        <span>Disagree</span>
                    </label>
                </div>
                <button type="submit" class="px-5 py-2 bg-antique-accent text-white rounded text-xs font-medium hover:bg-antique-accentHover transition-colors shadow-sm w-full sm:w-auto">
                    Submit Stance
                </button>
            </form>
    </div>
    `
)
})
} else {
    // POLICY ARTICLE RENDERING SECTION
      const policyArticle=document.getElementById("policyArticle")
      commentPostSection.style.display="none"
fetch("/policyFetch",{method:"POST",body:JSON.stringify({"requestType":"singlePolicyFetch","policyID":localStorage.getItem("policyID")})}).then(res=>{return res.json()}).then(data=>
{
policyArticle.insertAdjacentHTML("beforeend",
    `
   <div>
            
            <!-- Metadata Header -->
            <div class="flex flex-wrap items-center justify-between text-xs font-sans text-antique-muted mb-4 pb-4 border-b border-antique-border gap-2">
                <span class="uppercase tracking-wider px-2.5 py-1 bg-antique-bg border border-antique-border rounded font-medium text-antique-text">${data.category}</span>
                <span id="publishDate">Published on ${new Date(data.createdAt).toLocaleString()} &bull; Status: Active Public Consultation</span>
            </div>

            <!-- Title & Full Description -->
            <h1 class="text-2xl md:text-3xl font-normal mb-6 leading-snug">${data.title}</h1>
            
            <div class="space-y-4 text-sm text-antique-text font-sans leading-relaxed mb-6">
                <p>
                     ${data.summary}
                </p>

            </div>

            <!-- View Full Policy Document Link -->
            <div class="mb-8 font-sans">
                <a href=" ${data.pdfUrl}" target="_blank" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-antique-bg border border-antique-border rounded-lg text-xs font-medium text-antique-accent hover:bg-antique-border transition-colors shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span>View Full Policy Document (PDF) &rarr;</span>
                </a>
            </div>

            <!-- Aggregate Stance Distribution (No Coloring) -->
            <div class="mb-6 p-4 bg-antique-bg border border-antique-border rounded-lg font-sans text-xs">
                <span class="block text-antique-muted uppercase tracking-wider mb-2 font-semibold">Aggregate Public Stance (1,420 Total Votes)</span>
                <div class="flex flex-wrap items-center gap-6 text-sm">
                    <span>Agree: <strong class="text-antique-text">923</strong></span>
                    <span>Neutral: <strong class="text-antique-text">142</strong></span>
                    <span>Disagree: <strong class="text-antique-text">355</strong></span>
                </div>
            </div>

    </div>
    `
)
})
  }
})
 


