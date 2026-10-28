import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js"
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"

const firebaseConfig = {
    apiKey: "AIzaSyAXviVipDAJZl-xyiQE4JfACkcl1xt_CqM",
    authDomain: "hagere-c6abc.firebaseapp.com",
    projectId: "hagere-c6abc",
    storageBucket: "hagere-c6abc.firebasestorage.app",
    messagingSenderId: "272791886594",
    appId: "1:272791886594:web:05b9f9fd6fc98cdca3c01b"
}

const signOutButton=document.getElementById("signOutButton")
const auth=getAuth(initializeApp(firebaseConfig))
const activityFeed=document.getElementById("activityFeed")
const activityEmpty=document.getElementById("activityEmpty")
const profileLoading=document.getElementById("profileLoading")
const profileError=document.getElementById("profileError")
const profileErrorMessage=document.getElementById("profileErrorMessage")
const numberFormatter=new Intl.NumberFormat()
let isSigningOut=false

function showProfileError(message) {
    profileLoading.classList.add("hidden")
    profileErrorMessage.textContent=message
    profileError.classList.remove("hidden")
}

function renderActivity(data) {
    document.getElementById("profileName").textContent=data.profile.name || "Citizen Profile & Activity"
    const memberSince=data.profile.memberSince
    document.getElementById("memberSince").textContent=memberSince
        ? `Member since ${new Date(memberSince).toLocaleDateString()}`
        : "Member date unavailable"
    document.getElementById("totalVotes").textContent=numberFormatter.format(data.totalVotes)

    activityFeed.querySelectorAll("[data-activity-card]").forEach(card=>card.remove())
    if(data.activity.length===0){
        activityEmpty.classList.remove("hidden")
        return
    }

    activityEmpty.classList.add("hidden")
    for(const entry of data.activity){
        const card=document.createElement("article")
        card.dataset.activityCard=""
        card.className="bg-antique-card border border-antique-border rounded-lg p-6 flex flex-col justify-between"

        const details=document.createElement("div")
        const metadata=document.createElement("div")
        metadata.className="flex items-center justify-between gap-3 text-xs font-sans text-antique-muted mb-2"

        const category=document.createElement("span")
        category.className="uppercase tracking-wider px-2 py-0.5 bg-antique-bg border border-antique-border rounded"
        category.textContent=entry.category || "Policy"

        const date=document.createElement("span")
        date.textContent=entry.votedAt
            ? `Voted on: ${new Date(entry.votedAt).toLocaleDateString()}`
            : "Vote date unavailable"
        metadata.append(category,date)

        const title=document.createElement("h2")
        title.className="text-xl font-bold mb-2"
        title.textContent=entry.title

        const summary=document.createElement("p")
        summary.className="text-sm text-antique-muted font-sans mb-4"
        summary.textContent=entry.summary
        details.append(metadata,title,summary)

        const footer=document.createElement("div")
        footer.className="pt-4 border-t border-antique-border font-sans text-xs flex items-center justify-between"
        const stance=document.createElement("span")
        stance.className="px-2.5 py-1 bg-antique-bg border border-antique-border rounded font-medium text-antique-accent"
        stance.textContent=entry.stance || "Recorded"
        const link=document.createElement("a")
        link.className="text-antique-accent font-medium hover:underline"
        link.href="./policy.html"
        link.textContent="View Policy →"
        link.addEventListener("click",()=>localStorage.setItem("policyID",entry.policyId))
        footer.append(stance,link)

        card.append(details,footer)
        activityFeed.append(card)
    }
}

async function loadProfile(user) {
    profileError.classList.add("hidden")
    profileLoading.classList.remove("hidden")
    document.getElementById("activityFeed").setAttribute("aria-busy","true")
    try {
        const token=await user.getIdToken()
        const response=await fetch("/profile/activity",{
            headers:{Authorization:`Bearer ${token}`}
        })
        if(!response.ok){
            if(response.status===401){
                window.location.replace("./login.html")
                return
            }
            if(response.status===404){
                throw new Error("Your citizen profile is not available yet. Sign out and sign in again, or contact support.")
            }
            if(response.status===403){
                throw new Error("A verified citizen account is required to view profile activity.")
            }
            throw new Error(`Activity request failed (${response.status}). Please try again.`)
        }
        renderActivity(await response.json())
        profileLoading.classList.add("hidden")
    } catch(error) {
        showProfileError(error.message || "We couldn't load your activity. Please try again.")
    } finally {
        document.getElementById("activityFeed").setAttribute("aria-busy","false")
    }
}

onAuthStateChanged(auth,user=>{
    if(!user){
        if(!isSigningOut) window.location.replace("./login.html")
        return
    }
    document.body.classList.remove("hidden")
    loadProfile(user)
},error=>{
    document.body.classList.remove("hidden")
    showProfileError("We couldn't verify your session. Refresh the page or sign in again.")
    console.error(error)
})

document.getElementById("retryProfile").addEventListener("click",()=>{
    if(auth.currentUser) loadProfile(auth.currentUser)
})

signOutButton.addEventListener("click",async()=>{
    isSigningOut=true
    try {
        await signOut(auth)
        window.location.replace("./index.html")
    } catch(error) {
        isSigningOut=false
        showProfileError("Unable to sign out. Please try again.")
        console.error(error)
    }
})