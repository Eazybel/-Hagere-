/**
 * @file admin.js
 * @description Drives administrator policy/news publishing, deletion, list refresh, and dashboard metric updates.
 * @module Client/Admin
 * @requires Firebase App and Auth browser SDKs
 */
 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
 import { getAuth, signInWithPopup, GoogleAuthProvider , onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
  const firebaseConfig = {
   apiKey: "AIzaSyBg9v5J4qdDYQhYCl79Q1U5Nm7hzrQ7yMw",
  authDomain: "hagere-admin.firebaseapp.com",
  projectId: "hagere-admin",
  storageBucket: "hagere-admin.firebasestorage.app",
  messagingSenderId: "907064312662",
  appId: "1:907064312662:web:e716e0df19627c4a5dccf7"
  };
// Module state: authenticated admin context and references for publish forms, feedback, and list containers.
// Firebase ID tokens are attached to every privileged API request; the server enforces the admin allowlist.
//VARIABLE AND FIREBASE INITIATER
  const app = initializeApp(firebaseConfig);
  const auth=getAuth(app)
  const publishModal=document.getElementById("publishModal")
  const publishBtn=document.getElementById("publishBtn")
  const cancelBtn=document.getElementById("cancelBtn")
  const submitBtn=document.getElementById("submitBtn")
  const publishSpinner=document.getElementById("publishSpinner")
  const submitBtnText=document.getElementById("submitBtnText")
  const publishForm=document.getElementById("publishForm")
  const publishMessage=document.getElementById("publishMessage")
  // Do not initialize admin actions until Firebase has resolved the signed-in administrator.
  onAuthStateChanged(auth, (user) => {
  if (user) {
    // MODAL OOPENER AND CLOSER
 /** @listens click Opens the policy publishing view. */
 publishBtn.onclick=async()=>{
    publishModal.classList.remove("hidden")
    document.querySelector("main").classList.add("hidden")
   publishModal.focus()
 }
 /** @listens click Closes the publishing view and returns to the admin page. */
 const closePublishModal=()=>{
   document.querySelector("main").classList.remove("hidden")
   window.history.replaceState(null,"",`${window.location.pathname}${window.location.search}`)
   publishBtn.focus()
 }
 cancelBtn.onclick=event=>{
   event.preventDefault()
   closePublishModal()
 }
 document.addEventListener("keydown",event=>{
   if(event.key==="Escape" && window.location.hash==="#publishModal"){
     closePublishModal()
   }

 })
// --- STEP 1: VALIDATE FORM STATE, PUBLISH JSON, AND SHOW BUTTON PROGRESS ---
// SUBMIT HANDLER
/** @listens click Publishes a policy JSON payload, temporarily disabling the button and showing its spinner. */
submitBtn.onclick=async(e)=>{
  e.preventDefault()
  if(submitBtn.disabled) return
  submitBtn.disabled=true
  submitBtn.setAttribute("aria-busy","true")
  submitBtnText.textContent="Publishing…"
  publishSpinner.classList.remove("hidden")
  publishMessage.classList.add("hidden")
  try{
    const form=new FormData(publishForm)
    const token=await auth.currentUser.getIdToken()
    const res=await fetch("/api/policies",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${token}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        title:form.get("title"),
        category:form.get("sector"),
        description:form.get("description"),
        status:form.get("status"),
        documentUrl:form.get("documentUrl")
      })
    })
    const data=await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data.error || data.message || "Policy publishing failed")
    publishMessage.textContent="Policy published successfully"
    publishMessage.className="text-green-700"
    console.log(data)
    adminDataFetcher().catch(error=>console.error("Admin metrics refresh failed:",error))
    refreshAdminLists().catch(error=>console.error("Admin content refresh failed:",error))
  }catch(error){
    publishMessage.textContent=error.message || "Policy publishing failed"
    publishMessage.className="text-red-700"
    console.error(error)
  }finally{
    submitBtn.disabled=false
    submitBtn.removeAttribute("aria-busy")
    submitBtnText.textContent="Publish Post"
    publishSpinner.classList.add("hidden")
  }
  publishMessage.classList.remove("hidden")
}
// News publishing form state and controls.
const newsPublishForm=document.getElementById("newsPublishForm")
const newsRelatedPolicy=document.getElementById("newsRelatedPolicy")
const newsPublishMessage=document.getElementById("newsPublishMessage")
const newsSubmitButton=document.getElementById("newsSubmitButton")
const newsSubmitText=document.getElementById("newsSubmitText")
const newsPublishSpinner=document.getElementById("newsPublishSpinner")

/** Loads policy choices for linking a new news post. */
async function loadRelatedPolicies(){
  const response=await fetch("/api/policies",{cache:"no-store"})
  const policies=await response.json().catch(()=>null)
  if(!response.ok || !Array.isArray(policies)){
    throw new Error(policies?.error || "Unable to load policies for the news form")
  }
  for(const policy of policies){
    const option=document.createElement("option")
    option.value=policy._id
    option.textContent=policy.title
    newsRelatedPolicy.append(option)
  }
}

// Fill the relationship selector before a publisher chooses a policy relation.
loadRelatedPolicies().catch(error=>{
  console.error("Related policy list failed:",error)
  const option=document.createElement("option")
  option.value=""
  option.textContent="Policies could not be loaded"
  option.disabled=true
  newsRelatedPolicy.append(option)
})

/** @listens submit Publishes a news item as JSON and restores form controls after success or failure. */
newsPublishForm.addEventListener("submit",async event=>{
  event.preventDefault()
  if(newsSubmitButton.disabled) return
  newsSubmitButton.disabled=true
  newsSubmitButton.setAttribute("aria-busy","true")
  newsSubmitText.textContent="Publishing…"
  newsPublishSpinner.classList.remove("hidden")
  newsPublishMessage.classList.add("hidden")

  try{
    const token=await user.getIdToken()
    const formData=new FormData(newsPublishForm)
    const response=await fetch("/api/news",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${token}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        title:formData.get("title"),
        imageUrl:formData.get("imageUrl"),
        relatedPolicy:formData.get("relatedPolicy"),
        content:formData.get("content")
      })
    })
    const result=await response.json().catch(()=>({}))
    if(!response.ok || result.success!==true){
      throw new Error(result.error || `News publishing failed (${response.status})`)
    }
    newsPublishForm.reset()
    newsPublishMessage.textContent="Policy news published successfully."
    newsPublishMessage.className="text-sm text-green-700"
    refreshAdminLists().catch(error=>console.error("Admin content refresh failed:",error))
  }catch(error){
    console.error("News publishing failed:",error)
    newsPublishMessage.textContent=error.message || "News publishing failed."
    newsPublishMessage.className="text-sm text-red-700"
  }finally{
    newsSubmitButton.disabled=false
    newsSubmitButton.removeAttribute("aria-busy")
    newsSubmitText.textContent="Publish News"
    newsPublishSpinner.classList.add("hidden")
    newsPublishMessage.classList.remove("hidden")
  }
})
// --- STEP 2: REFRESH ADMIN METRICS AND CONTENT LISTS ---
// POLICY NUMBER UPDATE
/** Retrieves admin-only policy and user counts with the current Firebase ID token. */
const adminDataFetcher=async()=>{
  const token=await user.getIdToken()
  const headers={"Authorization":`Bearer ${token}`}
  const [policyResponse,userResponse]=await Promise.all([
    fetch("/admin/policyCount",{headers,cache:"no-store"}),
    fetch("/userFetch",{method:"POST",headers,body:JSON.stringify({requestType:"userNumberFetch"})})
  ])
  if(!policyResponse.ok || !userResponse.ok) throw new Error("Unable to load admin metrics")
  const [policyData,userData]=await Promise.all([policyResponse.json(),userResponse.json()])
  document.querySelector(".activePolicy").innerText=policyData.count
  document.querySelector(".activeCitizens").innerText=userData.count
}
const policyList=document.getElementById("adminPolicyList")
const newsList=document.getElementById("adminNewsList")
/**
 * Creates a confirmed deletion action with accessible pending state.
 * @param {string} label Item label used for confirmation and errors.
 * @param {string} endpoint Admin DELETE API URL.
 * @param {HTMLElement} card Card removed from the list after successful deletion.
 * @returns {HTMLButtonElement} Delete control.
 */
const makeDeleteButton=(label,endpoint,card)=>{
  const button=document.createElement("button")
  button.type="button"
  button.className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 transition-all duration-200 hover:border-red-300 hover:bg-red-50 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
  button.setAttribute("aria-label",`Delete ${label}`)
  const spinner=document.createElement("span")
  spinner.className="hidden h-3 w-3 animate-spin rounded-full border-2 border-red-300 border-t-red-700"
  spinner.setAttribute("aria-hidden","true")
  const text=document.createElement("span")
  text.textContent="Delete"
  button.append(spinner,text)
  /** @listens click Confirms, sends the authorized DELETE request, and removes only a successfully deleted card. */
  button.addEventListener("click",async()=>{
    if(!window.confirm(`Delete this ${label}? This action cannot be undone.`)) return
    button.disabled=true
    button.setAttribute("aria-busy","true")
    spinner.classList.remove("hidden")
    text.textContent="Deleting…"
    try{
      const token=await user.getIdToken()
      const response=await fetch(endpoint,{
        method:"DELETE",
        headers:{"Authorization":`Bearer ${token}`}
      })
      const result=await response.json().catch(()=>({}))
      if(!response.ok || result.success!==true){
        throw new Error(result.error || `Unable to delete ${label}`)
      }
      card.remove()
      adminDataFetcher().catch(error=>console.error("Admin metrics refresh failed:",error))
    }catch(error){
      console.error(`Admin ${label} deletion failed:`,error)
      window.alert(error.message || `Unable to delete ${label}`)
      button.disabled=false
      button.removeAttribute("aria-busy")
      spinner.classList.add("hidden")
      text.textContent="Delete"
    }
  })
  return button
}
/** Builds a text-safe policy/news card and attaches its delete control. */
const makeAdminCard=(titleText,detailText,label,endpoint)=>{
  const card=document.createElement("article")
  card.className="flex flex-col gap-4 rounded-xl border border-antique-border bg-antique-card p-4 shadow-sm transition-all duration-200 hover:border-blue-200 sm:flex-row sm:items-center sm:justify-between"
  const content=document.createElement("div")
  const title=document.createElement("p")
  title.className="font-medium"
  title.textContent=titleText || "Untitled"
  const detail=document.createElement("p")
  detail.className="mt-1 text-xs text-antique-muted"
  detail.textContent=detailText || ""
  content.append(title,detail)
  card.append(content,makeDeleteButton(label,endpoint,card))
  return card
}
/** Reloads public policy/news data and replaces both admin list contents. */
const refreshAdminLists=async()=>{
  const [policyResponse,newsResponse]=await Promise.all([
    fetch("/api/policies",{cache:"no-store"}),
    fetch("/api/news",{cache:"no-store"})
  ])
  const [policies,news]=await Promise.all([
    policyResponse.json().catch(()=>null),
    newsResponse.json().catch(()=>null)
  ])
  if(!policyResponse.ok || !Array.isArray(policies)){
    throw new Error(policies?.error || "Unable to load policies")
  }
  if(!newsResponse.ok || !Array.isArray(news)){
    throw new Error(news?.error || "Unable to load policy news")
  }
  policyList.replaceChildren(...policies.map(policy=>makeAdminCard(
    policy.title,
    policy.category,
    "policy",
    `/api/policies/${encodeURIComponent(policy._id)}`
  )))
  newsList.replaceChildren(...news.map(post=>makeAdminCard(
    post.title,
    post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "",
    "news post",
    `/api/news/${encodeURIComponent(post._id)}`
  )))
  if(!policies.length) policyList.textContent="No policies have been published."
  if(!news.length) newsList.textContent="No policy news has been published."
}
adminDataFetcher().catch(error=>console.error(error))
refreshAdminLists().catch(error=>{
  console.error("Admin content load failed:",error)
  policyList.textContent="Unable to load policies."
  newsList.textContent="Unable to load policy news."
})
    const uid = user.uid;
    // ...
  } else {
console.log("user is not signed up")
  }
})
 
