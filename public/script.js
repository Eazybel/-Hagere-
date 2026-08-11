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
fetch("/policyFetch").then(res=>{return res.json()}).then(data=>
{
  const policySection=document.getElementById("policySection")
  data.forEach(policy=>{
    policySection.insertAdjacentHTML("beforeend",
      `
            <article class="bg-antique-card border border-antique-border rounded-lg p-6 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs font-sans text-antique-muted mb-2">
                        <span class="uppercase tracking-wider px-2 py-0.5 bg-antique-bg border border-antique-border rounded">${policy.category}</span>
                        <span>Published: ${new Date(policy.createdAt).toLocaleString()}</span>
                    </div>
                    <h2 class="text-xl font-bold mb-2">
                       ${policy.title}
                    </h2>
                    <p class="text-sm text-antique-muted font-sans mb-4">
                       ${policy.summary}
                    </p>
                </div>

                <div>
                    <!-- Vote Counts Breakdown (No Coloring) & See Detail Button -->
                    <div class="mb-4 pt-2 border-t border-antique-border font-sans text-xs flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center space-x-3 text-antique-muted">
                            <span>Agree: <strong class="text-antique-text">923</strong></span>
                            <span>Neutral: <strong class="text-antique-text">142</strong></span>
                            <span>Disagree: <strong class="text-antique-text">355</strong></span>
                        </div>
                        <a href="policy-detail.html?id=1" class="text-antique-accent font-medium hover:underline">See the Detail &rarr;</a>
                    </div>

                    <!-- Voting & Interaction Form -->
                    <form class="pt-3 border-t border-antique-border font-sans flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div class="flex items-center space-x-4 text-xs">
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="radio" name="vote-1" value="agree" class="accent-antique-accent">
                                <span>Agree</span>
                            </label>
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="radio" name="vote-1" value="neutral" class="accent-antique-accent">
                                <span>Neutral</span>
                            </label>
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="radio" name="vote-1" value="disagree" class="accent-antique-accent">
                                <span>Disagree</span>
                            </label>
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto">
                            <button type="submit" class="px-3 py-1.5 bg-antique-accent text-white rounded text-xs font-medium hover:bg-antique-accentHover transition-colors flex-1 sm:flex-none">
                                Submit Vote
                            </button>
                            <a href="policy-detail.html?id=1#comments" class="px-3 py-1.5 border border-antique-border rounded text-xs font-medium hover:bg-antique-border transition-colors flex items-center justify-center gap-1">
                                Comments (48)
                            </a>
                        </div>
                    </form>
                </div>
            </article>
      `
    )
  })

}

)
 document.querySelector("body").classList.remove("hidden")
  }
});