import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider , onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
const translations = {
  en: {
    translate: "Translate", policiesFeed: "Policies Feed", myDashboard: "My Dashboard", signOut: "Sign Out",
    welcome: "Welcome back, Citizen", welcomeDescription: "Your voice matters. Cast your official stance on current legislative proposals or review your voting record in your profile.",
    searchPolicies: "Search policies by keyword or title...", filterSector: "Filter by Sector:", allSectors: "All Major Sectors",
    footerCopyright: "© 2026 Hagere Civic Platform. Open Source Initiative.", about: "About", privacy: "Privacy Policy", contribute: "Contribute", adminPortal: "Admin Portal",
    askAi: "Ask Hagere AI", assistant: "Hagere Assistant", assistantDescription: "Here to help you explore policies", assistantGreeting: "Hello. How can I help you understand a policy today?", askPolicy: "Ask about a policy...", send: "Send",
    published: "Published", agree: "Agree", neutral: "Neutral", disagree: "Disagree", comments: "Comments", explore: "Explore full policy document & discussions", readVote: "Read, Vote & Comment →"
  },
  am: {
    translate: "ተርጉም", policiesFeed: "የፖሊሲዎች መጋቢ", myDashboard: "የእኔ ዳሽቦርድ", signOut: "ውጣ",
    welcome: "እንኳን ደህና መጡ፣ ዜጋ", welcomeDescription: "ድምፅዎ አስፈላጊ ነው። በወቅታዊ የሕግ ረቂቆች ላይ አቋምዎን ይስጡ ወይም የድምፅ መዝገብዎን ይመልከቱ።",
    searchPolicies: "ፖሊሲዎችን በቁልፍ ቃል ወይም በርዕስ ይፈልጉ...", filterSector: "በዘርፍ ያጣሩ፦", allSectors: "ሁሉም ዋና ዘርፎች",
    footerCopyright: "© 2026 የሀገሬ የዜጎች መድረክ። ክፍት ምንጭ ተነሳሽነት።", about: "ስለ እኛ", privacy: "የግላዊነት ፖሊሲ", contribute: "አስተዋጽኦ ያድርጉ", adminPortal: "የአስተዳዳሪ መግቢያ",
    askAi: "ሀገሬ AIን ይጠይቁ", assistant: "የሀገሬ ረዳት", assistantDescription: "ፖሊሲዎችን እንዲያስሱ ለመርዳት እዚህ ነኝ", assistantGreeting: "ስለ ፖሊሲ እንዲረዱ እንዴት ልርዳዎት?", askPolicy: "ስለ ፖሊሲ ይጠይቁ...", send: "ላክ",
    published: "የታተመበት", agree: "እስማማለሁ", neutral: "ገለልተኛ", disagree: "አልስማማም", comments: "አስተያየቶች", explore: "ሙሉ የፖሊሲ ሰነዱን እና ውይይቶችን ያስሱ", readVote: "ያንብቡ፣ ድምፅ ይስጡ እና ያስተያየቱ"
  },
  om: {
    translate: "Hiiki", policiesFeed: "Tarreeffama Imaammataa", myDashboard: "Daashboordii Koo", signOut: "Ba'i",
    welcome: "Baga nagaan dhuftan, Lammii", welcomeDescription: "Sagaleen keessan barbaachisaa dha. Yaada keessan wixinee seeraa irratti kennaa ykn galmee sagalee keessanii ilaalaa.",
    searchPolicies: "Imaammata jecha ijoo ykn mata-dureen barbaadi...", filterSector: "Kutaan ittiin calali:", allSectors: "Kutaalee Gurguddoo Hunda",
    footerCopyright: "© 2026 Waltajjii Lammii Hagere. Tattaaffii Madda Banaa.", about: "Waa'ee Keenya", privacy: "Imaammata Dhuunfaa", contribute: "Gumaachi", adminPortal: "Seensa Bulchaa",
    askAi: "Hagere AI gaafadhu", assistant: "Gargaaraa Hagere", assistantDescription: "Imaammata qorachuuf isin gargaaruuf as jira", assistantGreeting: "Har'a imaammata hubachuuf akkamitti isin gargaaruu danda'a?", askPolicy: "Waa'ee imaammataa gaafadhu...", send: "Ergi",
    published: "Maxxanfame", agree: "Nan waliigala", neutral: "Giddugaleessa", disagree: "Waliin hin galu", comments: "Yaada", explore: "Sanada imaammataa guutuu fi marii qoradhu", readVote: "Dubbisi, Sagalee kenni fi Yaada kenni"
  },
  ti: {
    translate: "ተርጉም", policiesFeed: "መግበሪ ፖሊሲታት", myDashboard: "ዳሽቦርደይ", signOut: "ውጻእ",
    welcome: "እንቋዕ ደሓን መጻእኩም፣ ዜጋ", welcomeDescription: "ድምጽኹም ኣገዳሲ እዩ። ኣብ እዋናዊ ረቂቕ ሕግታት ኣቋምኩም ሃቡ ወይ መዝገብ ድምጽኹም ርኣዩ።",
    searchPolicies: "ፖሊሲታት ብቐንዲ ቃል ወይ ብኣርእስቲ ድለዩ...", filterSector: "ብዘርፊ ምጽራይ፦", allSectors: "ኩሎም ዋና ዘርፍታት",
    footerCopyright: "© 2026 መድረኽ ዜጋታት ሀገሬ። ክፉት ምንጪ ተበግሶ።", about: "ብዛዕባና", privacy: "ፖሊሲ ምስጢራዊነት", contribute: "ኣበርክቱ", adminPortal: "መእተዊ ኣስተዳዳሪ",
    askAi: "ሀገሬ AI ሕተት", assistant: "ሓጋዚ ሀገሬ", assistantDescription: "ፖሊሲታት ንኽትድህስሱ ንምሕጋዝ ኣብዚ ኣለኹ", assistantGreeting: "ሎሚ ፖሊሲ ንኽትርድኡ ከመይ ክሕግዘኩም ይኽእል?", askPolicy: "ብዛዕባ ፖሊሲ ሕተት...", send: "ስደድ",
    published: "ዝተሓትመ", agree: "እሰማማዕ", neutral: "ማእከላይ", disagree: "ኣይሰማማዕን", comments: "ርእይቶታት", explore: "ምሉእ ሰነድ ፖሊሲን ዘተታትን ድህሰሱ", readVote: "ኣንብብ፣ ድምጺ ሃብ እና ርእይቶ ሃብ"
  }
};

let currentLanguage = localStorage.getItem("hagereLanguage") || "en";

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

async function translateDynamicText(text, language) {
  if (!text || language === "en") return text;
  const languageCode = translationLanguageCodes[language];
  if (!languageCode) return text;

  const cacheKey = `${language}:${text}`;
  if (dynamicTranslationCache.has(cacheKey)) return dynamicTranslationCache.get(cacheKey);

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

async function translateDynamicContent(language) {
  const dynamicElements = [...document.querySelectorAll("[data-dynamic-translation]")];
  await Promise.all(dynamicElements.map(async (element) => {
    if (!element.dataset.originalText) element.dataset.originalText = element.textContent.trim();
    element.textContent = await translateDynamicText(element.dataset.originalText, language);
  }));
}

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
onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
localStorage.setItem("userEmail",user.email)
fetch("/policyFetch",{method:"POST",body:JSON.stringify({"requestType":"policyDataFetch"})}).then(res=>{return res.json()}).then(data=>
{
     const policySection=document.getElementById("policySection")
    if(data.length<1){
policySection.insertAdjacentHTML("beforeend",`<div class="col-span-full py-12 text-center bg-antique-card border border-antique-border rounded-lg font-sans">
    <p class="text-antique-muted text-sm">No Policies Posted Yet.</p>
</div>`)
    }else{

          
  data.forEach(policy=>{
    policySection.insertAdjacentHTML("beforeend",
      `
        <article class="bg-antique-card border border-antique-border rounded-lg p-6 flex flex-col justify-between">
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
        <!-- Vote Counts Breakdown Analytics -->
        <div class="mb-4 pt-2 border-t border-antique-border font-sans text-xs flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center space-x-3 text-antique-muted">
                                <span><span data-i18n="agree">Agree</span>: <strong class="text-antique-text">${Math.floor(Math.random() * 181) + 40}</strong></span>
                                <span><span data-i18n="neutral">Neutral</span>: <strong class="text-antique-text">${Math.floor(Math.random() * 73) + 8}</strong></span>
                                <span><span data-i18n="disagree">Disagree</span>: <strong class="text-antique-text">${Math.floor(Math.random() * 61) + 5}</strong></span>
            </div>
                            <span class="text-antique-muted"><span data-i18n="comments">Comments</span>: <strong class="text-antique-text">${Math.floor(Math.random() * 43) + 3}</strong></span>
        </div>

        <!-- Action Link to Vote, Read & Comment -->
        <div class="pt-3 border-t border-antique-border font-sans flex items-center justify-between">
            <span data-i18n="explore" class="text-xs text-antique-muted">Explore full policy document & discussions</span>
            <button type="button" class="px-4 py-2 bg-antique-accent text-white rounded text-xs font-medium hover:bg-antique-accentHover transition-colors shadow-sm inline-block policyRedirectBtn">
                <span data-i18n="readVote">Read, Vote & Comment →</span>
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
  // TITLE FILTERING SECTION
  const titleFilter=document.getElementById("titleFilter")
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
    redirect.onclick=()=>{
       const idLabel=redirect.parentElement.querySelector(".idLabel").innerText
      localStorage.setItem("policyID",idLabel)
      window.location.href="./policy.html"
    }
})
})
  } else {
window.location.href="./index.html"
  }
});
signOutButton.onclick=()=>{
  signOut(auth).then(() => {
    window.location.href("./index.html")
}).catch((error) => {
  console.log(error)
});
}