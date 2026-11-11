/**
* @file feed.js
* @description Renders the authenticated citizen policy feed, locale translations, and catalog filters.
* @module Client/PolicyFeed
* @requires Firebase App and Auth browser SDKs and translation API for dynamic text
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider , onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
// Translation dictionaries hold static UI text; dynamic policy strings are cached separately.
const translations = {
  en: {
    translate: "Translate", policiesFeed: "Policies Feed", myDashboard: "My Dashboard", signOut: "Sign Out",
    welcome: "Welcome back, Citizen", welcomeDescription: "Your voice matters. Cast your official stance on current legislative proposals or review your voting record in your profile.",
    searchPolicies: "Search policies by keyword or title...", filterSector: "Filter by Sector:", allSectors: "All Major Sectors",
    footerCopyright: "© 2026 Hagere Civic Platform. Open Source Initiative.", about: "About", privacy: "Privacy Policy", contribute: "Contribute", adminPortal: "Admin Portal",
    askAi: "Ask Hagere AI", assistant: "Hagere Assistant", assistantDescription: "Here to help you explore policies", assistantGreeting: "Hello. How can I help you understand a policy today?", askPolicy: "Ask about a policy...", send: "Send",
    published: "Published", views: "Views", explore: "Open the full policy details", readVote: "Read Policy →"
  },
  am: {
    translate: "ተርጉም", policiesFeed: "የፖሊሲዎች መጋቢ", myDashboard: "የእኔ ዳሽቦርድ", signOut: "ውጣ",
    welcome: "እንኳን ደህና መጡ፣ ዜጋ", welcomeDescription: "ድምፅዎ አስፈላጊ ነው። በወቅታዊ የሕግ ረቂቆች ላይ አቋምዎን ይስጡ ወይም የድምፅ መዝገብዎን ይመልከቱ።",
    searchPolicies: "ፖሊሲዎችን በቁልፍ ቃል ወይም በርዕስ ይፈልጉ...", filterSector: "በዘርፍ ያጣሩ፦", allSectors: "ሁሉም ዋና ዘርፎች",
    footerCopyright: "© 2026 የሀገሬ የዜጎች መድረክ። ክፍት ምንጭ ተነሳሽነት።", about: "ስለ እኛ", privacy: "የግላዊነት ፖሊሲ", contribute: "አስተዋጽኦ ያድርጉ", adminPortal: "የአስተዳዳሪ መግቢያ",
    askAi: "ሀገሬ AIን ይጠይቁ", assistant: "የሀገሬ ረዳት", assistantDescription: "ፖሊሲዎችን እንዲያስሱ ለመርዳት እዚህ ነኝ", assistantGreeting: "ስለ ፖሊሲ እንዲረዱ እንዴት ልርዳዎት?", askPolicy: "ስለ ፖሊሲ ይጠይቁ...", send: "ላክ",
    published: "የታተመበት", views: "እይታዎች", explore: "ሙሉ የፖሊሲ ዝርዝሮችን ይክፈቱ", readVote: "ፖሊሲውን ያንብቡ →"
  },
  om: {
    translate: "Hiiki", policiesFeed: "Tarreeffama Imaammataa", myDashboard: "Daashboordii Koo", signOut: "Ba'i",
    welcome: "Baga nagaan dhuftan, Lammii", welcomeDescription: "Sagaleen keessan barbaachisaa dha. Yaada keessan wixinee seeraa irratti kennaa ykn galmee sagalee keessanii ilaalaa.",
    searchPolicies: "Imaammata jecha ijoo ykn mata-dureen barbaadi...", filterSector: "Kutaan ittiin calali:", allSectors: "Kutaalee Gurguddoo Hunda",
    footerCopyright: "© 2026 Waltajjii Lammii Hagere. Tattaaffii Madda Banaa.", about: "Waa'ee Keenya", privacy: "Imaammata Dhuunfaa", contribute: "Gumaachi", adminPortal: "Seensa Bulchaa",
    askAi: "Hagere AI gaafadhu", assistant: "Gargaaraa Hagere", assistantDescription: "Imaammata qorachuuf isin gargaaruuf as jira", assistantGreeting: "Har'a imaammata hubachuuf akkamitti isin gargaaruu danda'a?", askPolicy: "Waa'ee imaammataa gaafadhu...", send: "Ergi",
    published: "Maxxanfame", views: "Ilaalcha", explore: "Bal'ina imaammataa guutuu bani", readVote: "Imaammata dubbisi →"
  },
  ti: {
    translate: "ተርጉም", policiesFeed: "መግበሪ ፖሊሲታት", myDashboard: "ዳሽቦርደይ", signOut: "ውጻእ",
    welcome: "እንቋዕ ደሓን መጻእኩም፣ ዜጋ", welcomeDescription: "ድምጽኹም ኣገዳሲ እዩ። ኣብ እዋናዊ ረቂቕ ሕግታት ኣቋምኩም ሃቡ ወይ መዝገብ ድምጽኹም ርኣዩ።",
    searchPolicies: "ፖሊሲታት ብቐንዲ ቃል ወይ ብኣርእስቲ ድለዩ...", filterSector: "ብዘርፊ ምጽራይ፦", allSectors: "ኩሎም ዋና ዘርፍታት",
    footerCopyright: "© 2026 መድረኽ ዜጋታት ሀገሬ። ክፉት ምንጪ ተበግሶ።", about: "ብዛዕባና", privacy: "ፖሊሲ ምስጢራዊነት", contribute: "ኣበርክቱ", adminPortal: "መእተዊ ኣስተዳዳሪ",
    askAi: "ሀገሬ AI ሕተት", assistant: "ሓጋዚ ሀገሬ", assistantDescription: "ፖሊሲታት ንኽትድህስሱ ንምሕጋዝ ኣብዚ ኣለኹ", assistantGreeting: "ሎሚ ፖሊሲ ንኽትርድኡ ከመይ ክሕግዘኩም ይኽእል?", askPolicy: "ብዛዕባ ፖሊሲ ሕተት...", send: "ስደድ",
    published: "ዝተሓትመ", views: "ርእይቶታት", explore: "ምሉእ ዝርዝር ፖሊሲ ክፈት", readVote: "ፖሊሲ ኣንብብ →"
  }
};

/** Current selected interface language, persisted across page visits. */
let currentLanguage = localStorage.getItem("hagereLanguage") || "en";

/** Applies local dictionary strings and placeholders to the current document. */
function applyTranslation(language) {
  const dictionary = translations[language] || translations.en;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const translatedText = dictionary[element.dataset.i18n];
    if (translatedText) element.textContent = translatedText;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const translatedText = dictionary[element.dataset.i18nPlaceholder];
    if (translatedText) element.placeholder = translatedText;
  });
}

const dynamicTranslationCache = new Map();
const translationLanguageCodes = { am: "am", om: "om", ti: "ti" };

/** Translates a dynamic string, reusing cached values and retaining source text on provider failure. */
async function translateDynamicText(text, language) {
  if (!text || language === "en") return text;
  const languageCode = translationLanguageCodes[language];
  if (!languageCode) return text;

  const cacheKey = `${language}:${text}`;
  if (dynamicTranslationCache.has(cacheKey)) return dynamicTranslationCache.get(cacheKey);
//TEMPORARY PUSH TO OTHER BRANCH FOR CHECKOUT
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${languageCode}`);
    if (!response.ok) return text;
    const result = await response.json();
    const translatedText = result.responseData?.translatedText || text;
    dynamicTranslationCache.set(cacheKey, translatedText);
    return translatedText;
  } catch (error) {
    console.warn("Dynamic translation unavailable:", error);
    return text;
  }
}

/** Translates marked policy content concurrently while retaining the original text for language switches. */
async function translateDynamicContent(language) {
  const dynamicElements = [...document.querySelectorAll("[data-dynamic-translation]")];
  await Promise.all(dynamicElements.map(async (element) => {
    if (!element.dataset.originalText) element.dataset.originalText = element.textContent.trim();
    element.textContent = await translateDynamicText(element.dataset.originalText, language);
  }));
}

// A language selection updates persisted preference, static labels, and dynamically loaded policy text.
document.querySelectorAll("[data-language]").forEach((languageButton) => {
  languageButton.addEventListener("click", async () => {
    currentLanguage = languageButton.dataset.language;
    localStorage.setItem("hagereLanguage", currentLanguage);
    applyTranslation(currentLanguage);
    await translateDynamicContent(currentLanguage);
    languageButton.closest("details")?.removeAttribute("open");
  });
});

applyTranslation(currentLanguage);
  const firebaseConfig = {
    apiKey: "AIzaSyAXviVipDAJZl-xyiQE4JfACkcl1xt_CqM",
    authDomain: "hagere-c6abc.firebaseapp.com",
    projectId: "hagere-c6abc",
    storageBucket: "hagere-c6abc.firebasestorage.app",
    messagingSenderId: "272791886594",
    appId: "1:272791886594:web:05b9f9fd6fc98cdca3c01b"
  };
// variable initiation
const signOutButton=document.getElementById("signOutButton")
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth=getAuth(app)
  // Anonymous visitors are served the read-only catalog by script.js.
  /** Loads personalized engagement and the citizen feed after Firebase resolves authentication. */
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const uid = user.uid;
  localStorage.setItem("userEmail",user.email)
  // Fetch the policy catalog using the authenticated citizen's identity.
  user.getIdToken().then(token=>fetch("/api/policies",{
    cache:"no-store",
    headers:{"Authorization":`Bearer ${token}`}
  })).then(async response=>{
  const data=await response.json()
  if(!response.ok){
    throw new Error(data.message || data.error || `Policy request failed (${response.status})`)
  }
  if(!Array.isArray(data)){
    throw new Error("Policy response was not a list")
  }
  return data
}).then(data=>
{
     const policySection=document.getElementById("policySection")
    policySection.replaceChildren()
    if(data.length===0){
      const emptyState=document.createElement("p")
      emptyState.className="col-span-full py-12 text-center text-antique-muted text-sm bg-antique-card border border-antique-border rounded-lg font-sans"
      emptyState.textContent="No policies published yet."
      policySection.append(emptyState)
    }else{

          
  data.forEach(policy=>{
    policySection.insertAdjacentHTML("beforeend",
      `
        <article data-policy-id="${policy._id}" class="bg-antique-card border border-antique-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
    <div>
        <div class="flex items-center justify-between text-xs font-sans text-antique-muted mb-2">
            <div class="flex items-center space-x-2">
                <span data-dynamic-translation class="uppercase tracking-wider px-2 py-0.5 bg-antique-bg border border-antique-border rounded category">${policy.category}</span>
                <span data-dynamic-translation class="uppercase tracking-wider px-2 py-0.5 bg-antique-bg border border-antique-border rounded status">${policy.status}</span>
            </div>
            <span><span data-i18n="published">Published</span>: ${new Date(policy.createdAt).toLocaleString()}</span>
        </div>
        <h2 data-dynamic-translation class="text-xl font-bold mb-2 title">
            ${policy.title}
        </h2>
        <p data-dynamic-translation class="text-sm text-antique-muted font-sans mb-4 line-clamp-4">
            ${policy.summary}
        </p>
    </div>

    <div>
        <div class="mb-4 pt-2 border-t border-antique-border font-sans text-xs">
            <span class="text-antique-muted"><span data-i18n="views">Views</span>: <strong class="text-antique-text">${policy.viewCount ?? 0}</strong></span>
        </div>

        <!-- Open the policy details before engaging with its content. -->
        <div class="pt-3 border-t border-antique-border font-sans flex items-center justify-between">
            <span data-i18n="explore" class="text-xs text-antique-muted">Open the full policy details</span>
            <button type="button" class="px-4 py-2 bg-antique-accent text-white rounded text-xs font-medium hover:bg-antique-accentHover transition-colors shadow-sm inline-block policyRedirectBtn">
                <span data-i18n="readVote">Read Policy →</span>
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

).then(async ()=>{
  // --- STEP 1: APPLY TITLE/CATEGORY FILTERS, THEN RESTORE THE SELECTED LANGUAGE ---
  // TITLE FILTERING SECTION
  const titleFilter=document.getElementById("titleFilter")
/** Filters visible policy cards by title as the citizen types. */
titleFilter.onkeydown=(e)=>{
    const target=e.target.value.toLowerCase()
    let titleText=document.querySelectorAll(".title")
    titleText.forEach(titles=>{
    const titleLower=(titles.dataset.originalText || titles.innerText).toLowerCase()
    if(!titleLower.includes(target)){
        titles.parentElement.parentElement.style.display="none"
        
    }else if(titleLower.includes(target)){
    titles.parentElement.parentElement.style.display=""
    }
    })
    
}
// CATEGORY FILTER SECTION
const policySection=document.getElementById("policySection")
const catagoryFilter=document.getElementById("policy-category")
const categoryLabel=document.querySelectorAll(".category")
/** Shows only policies matching the selected category. */
catagoryFilter.addEventListener("change",(e)=>{
  const targetValue=e.target.value.toLowerCase()
categoryLabel.forEach(label=>{
 const labelToLower=(label.dataset.originalText || label.innerText).trim().toLowerCase()
 if(targetValue=="all major sectors"){
label.closest("article").style.display=""

 }else if(labelToLower==targetValue){

label.closest("article").style.display=""
}else if(labelToLower!=targetValue){
label.closest("article").style.display="none"
}
})
})
applyTranslation(currentLanguage)
await translateDynamicContent(currentLanguage)
// POLICY REDIRECT SECTION
const policyRedirectBtn=document.querySelectorAll(".policyRedirectBtn")
policyRedirectBtn.forEach(redirect=>{
    /** Stores the selected policy ID before opening its detail view. */
    redirect.onclick=()=>{
       const idLabel=redirect.parentElement.querySelector(".idLabel").innerText
      localStorage.setItem("policyID",idLabel)
      window.location.href="./policy.html"
    }
})
})
 .catch(error=>{
  const policySection=document.getElementById("policySection")
  const errorState=document.createElement("p")
  errorState.className="col-span-full py-12 text-center text-rose-700 text-sm bg-antique-card border border-antique-border rounded-lg font-sans"
  errorState.textContent="Unable to load policies. Please try again later."
  policySection.replaceChildren(errorState)
  console.error("Policy feed request failed:",error)
})
  } else {
window.location.href="./index.html"
  }
});
/** Signs out the citizen and returns to the public landing page. */
/** @listens click Signs out and returns the visitor to the public landing page. */
signOutButton.onclick=()=>{
  signOut(auth).then(() => {
    window.location.href("./index.html")
}).catch((error) => {
  console.log(error)
});
}