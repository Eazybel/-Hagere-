import { applyOptimisticVote } from "./voteState.mjs"

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
  const commentThread=document.getElementById("commentThread")
  const commentCount=document.getElementById("commentCount")
  const commentStatus=document.getElementById("commentStatus")
  let renderedComments=[]

  function showPolicyLoadError(policyArticle,error) {
    console.error("Policy detail request failed:",error)
    const errorState=document.createElement("p")
    errorState.className="text-sm text-rose-700"
    errorState.textContent="Unable to load this policy. Please try again."
    policyArticle.replaceChildren(errorState)
  }

  function enablePolicyChat(policyId) {
    const form=document.getElementById("policyChatForm")
    const input=document.getElementById("policyChatMessage")
    const submitButton=document.getElementById("policyChatSubmit")
    const status=document.getElementById("policyChatStatus")
    const reply=document.getElementById("policyChatReply")

    form.addEventListener("submit",async event=>{
      event.preventDefault()
      if(submitButton.disabled) return
      submitButton.disabled=true
      submitButton.setAttribute("aria-busy","true")
      status.textContent="Reading the policy and preparing an answer. This may take a few minutes…"
      reply.classList.add("hidden")

      try{
        const response=await fetch(`/api/policies/${encodeURIComponent(policyId)}/chat`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({message:input.value.trim()})
        })
        const result=await response.json().catch(()=>({}))
        if(!response.ok || result.success!==true){
          throw new Error(result.error || `Policy assistant request failed (${response.status})`)
        }
        if(result.interactionId){
          const deadline=Date.now()+5*60*1000
          let interaction=result
          while(interaction.status!=="completed" && Date.now()<deadline){
            await new Promise(resolve=>setTimeout(resolve,2000))
            const pollResponse=await fetch(
              `/api/policies/${encodeURIComponent(policyId)}/chat/${encodeURIComponent(result.interactionId)}`,
              {cache:"no-store"}
            )
            interaction=await pollResponse.json().catch(()=>({}))
            if(!pollResponse.ok || interaction.success!==true){
              throw new Error(interaction.error || `Policy assistant request failed (${pollResponse.status})`)
            }
            if(interaction.status!=="completed"){
              status.textContent="The policy assistant is still reviewing the document…"
            }
          }
          if(interaction.status!=="completed"){
            throw new Error("The policy assistant is taking longer than expected. Please try again.")
          }
          result.reply=interaction.reply
        }
        if(typeof result.reply!=="string" || !result.reply.trim()){
          throw new Error("The policy assistant returned no answer.")
        }
        reply.textContent=result.reply
        reply.classList.remove("hidden")
        status.textContent=""
        input.value=""
      }catch(error){
        console.error("Policy chat request failed:",error)
        status.textContent=error.message || "Unable to contact the policy assistant. Please try again."
      }finally{
        submitButton.disabled=false
        submitButton.removeAttribute("aria-busy")
      }
    })
  }

  function renderComments(policy) {
    renderedComments=Array.isArray(policy.interactions?.comments)
      ? policy.interactions.comments
      : []
    commentCount.textContent=String(renderedComments.length)
    commentThread.replaceChildren()

    if(!renderedComments.length){
      const emptyState=document.createElement("p")
      emptyState.className="text-sm text-antique-muted"
      emptyState.textContent="No comments yet."
      commentThread.append(emptyState)
      return
    }

    renderedComments.forEach(comment=>{
      const card=document.createElement("article")
      card.className="rounded-lg border border-antique-border bg-antique-bg p-4"
      const header=document.createElement("div")
      header.className="mb-2 flex items-center justify-between gap-4 text-xs text-antique-muted"
      const author=document.createElement("span")
      author.className="font-medium text-antique-text"
      author.textContent="Verified citizen"
      const date=document.createElement("time")
      const createdAt=new Date(comment.createdAt)
      date.textContent=Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleString()
      header.append(author,date)
      const text=document.createElement("p")
      text.className="text-sm leading-relaxed text-antique-text"
      text.textContent=comment.text
      card.append(header,text)
      commentThread.append(card)
    })
  }

  function enableCommentSubmission(user, policyId) {
    commentPostSection.addEventListener("submit",async event=>{
      event.preventDefault()
      const input=document.getElementById("new-comment")
      const text=input.value.trim()
      if(!text || text.length>2000){
        commentStatus.textContent="Comments must be between 1 and 2000 characters."
        commentStatus.className="text-xs text-rose-700"
        return
      }

      const submitButton=commentPostSection.querySelector("button[type='submit']")
      submitButton.disabled=true
      commentStatus.textContent="Posting comment…"
      commentStatus.className="text-xs text-antique-muted"
      try{
        const token=await user.getIdToken()
        const response=await fetch("/policyComment",{
          method:"POST",
          headers:{
            "Authorization":`Bearer ${token}`,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({policyId,text})
        })
        const result=await response.json()
        if(!response.ok){
          throw new Error(result.message || result.error || `Comment request failed (${response.status})`)
        }
        renderComments({interactions:{comments:[...renderedComments,result.comment]}})
        commentPostSection.reset()
        commentStatus.textContent="Your comment was posted."
        commentStatus.className="text-xs text-emerald-700"
      }catch(error){
        console.error("Policy comment submission failed:",error)
        commentStatus.textContent=error.message || "Your comment could not be posted. Please try again."
        commentStatus.className="text-xs text-rose-700"
      }finally{
        submitButton.disabled=false
      }
    })
  }

  onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const idToken = await user.getIdToken()
    // POLICY ARTICLE RENDERING SECTION
      const policyArticle=document.getElementById("policyArticle")
fetch("/policyFetch",{method:"POST",headers:{"Authorization":`Bearer ${idToken}`},body:JSON.stringify({"requestType":"singlePolicyFetch","policyID":localStorage.getItem("policyID")})}).then(res=>{return res.json()}).then(data=>
{
if(!data.singlePolicy || !Array.isArray(data.userVoted)) throw new Error(data.error || data.message || "Policy response was invalid")
console.log(data)
renderComments(data.singlePolicy)
enablePolicyChat(data.singlePolicy._id)
enableCommentSubmission(user,data.singlePolicy._id)
if(data.userVoted[0]==true){
policyArticle.insertAdjacentHTML("beforeend",
    `
 <div>
        <!-- Metadata Header -->
        <div class="flex flex-wrap items-center justify-between text-xs font-sans text-antique-muted mb-4 pb-4 border-b border-antique-border gap-2">
            <div class="flex items-center space-x-2">
                <span class="uppercase tracking-wider px-2.5 py-1 bg-antique-bg border border-antique-border rounded font-medium text-antique-text">${data.singlePolicy.category}</span>
                <span class="uppercase tracking-wider px-2 py-0.5 bg-antique-bg border border-antique-border rounded text-[10px] font-semibold text-antique-accent bg-antique-accent/10">You Voted: ${data.userVoted[1]}</span>
            </div>
            <span id="publishDate">Published on ${new Date(data.singlePolicy.createdAt).toLocaleString()} &bull; Status: ${data.singlePolicy.status} &bull; Views: ${data.singlePolicy.viewCount ?? 0}</span>
        </div>
        <label id="policyId" class="hidden">${data.singlePolicy._id}</label>
        <!-- Title & Full Description -->
        <h1 class="text-2xl md:text-3xl font-normal mb-6 leading-snug">${data.singlePolicy.title}</h1>
        
        <div class="space-y-4 text-sm text-antique-text font-sans leading-relaxed mb-6">
            <p>
                 ${data.singlePolicy.summary}
            </p>

        </div>

        <!-- View Full Policy Document Link -->
        <div class="mb-8 font-sans">
            <a href=" ${data.singlePolicy.pdfUrl}" target="_blank" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-antique-bg border border-antique-border rounded-lg text-xs font-medium text-antique-accent hover:bg-antique-border transition-colors shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span>View Full Policy Document (PDF) &rarr;</span>
            </a>
        </div>

        <!-- Aggregate Stance Distribution (No Coloring) -->
        <div class="mb-6 p-4 bg-antique-bg border border-antique-border rounded-lg font-sans text-xs">
            <span class="block text-antique-muted uppercase tracking-wider mb-2 font-semibold">Aggregate Public Stance</span>
            <div class="flex flex-wrap items-center gap-6 text-sm">
                <span>Agree: <strong id="agreeVoteCount" class="text-antique-text">${data.singlePolicy.interactions?.votes?.agree?.count || 0}</strong></span>
                <span>Neutral: <strong id="neutralVoteCount" class="text-antique-text">${data.singlePolicy.interactions?.votes?.neutral?.count || 0}</strong></span>
                <span>Disagree: <strong id="disagreeVoteCount" class="text-antique-text">${data.singlePolicy.interactions?.votes?.disagree?.count || 0}</strong></span>
            </div>
        </div>

    </div>
    `
    
)
}else if(data.userVoted[0]==false){
    policyArticle.insertAdjacentHTML("beforeend",
    `
  <div>
        <!-- Metadata Header -->
        <div class="flex flex-wrap items-center justify-between text-xs font-sans text-antique-muted mb-4 pb-4 border-b border-antique-border gap-2">
            <span class="uppercase tracking-wider px-2.5 py-1 bg-antique-bg border border-antique-border rounded font-medium text-antique-text">${data.singlePolicy.category}</span>
            <span id="publishDate">Published on ${new Date(data.singlePolicy.createdAt).toLocaleString()} &bull; Status: ${data.singlePolicy.status} &bull; Views: ${data.singlePolicy.viewCount ?? 0}</span>
        </div>
        <label id="policyId" class="hidden">${data.singlePolicy._id}</label>
        <!-- Title & Full Description -->
        <h1 class="text-2xl md:text-3xl font-normal mb-6 leading-snug">${data.singlePolicy.title}</h1>
        
        <div class="space-y-4 text-sm text-antique-text font-sans leading-relaxed mb-6">
            <p>
                 ${data.singlePolicy.summary}
            </p>

        </div>

        <!-- View Full Policy Document Link -->
        <div class="mb-8 font-sans">
            <a href=" ${data.singlePolicy.pdfUrl}" target="_blank" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-antique-bg border border-antique-border rounded-lg text-xs font-medium text-antique-accent hover:bg-antique-border transition-colors shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span>View Full Policy Document (PDF) &rarr;</span>
            </a>
        </div>

        <!-- Aggregate Stance Distribution (No Coloring) -->
        <div class="mb-6 p-4 bg-antique-bg border border-antique-border rounded-lg font-sans text-xs">
            <span class="block text-antique-muted uppercase tracking-wider mb-2 font-semibold">Aggregate Public Stance</span>
            <div class="flex flex-wrap items-center gap-6 text-sm">
                <span>Agree: <strong id="agreeVoteCount" class="text-antique-text">${data.singlePolicy.interactions?.votes?.agree?.count || 0}</strong></span>
                <span>Neutral: <strong id="neutralVoteCount" class="text-antique-text">${data.singlePolicy.interactions?.votes?.neutral?.count || 0}</strong></span>
                <span>Disagree: <strong id="disagreeVoteCount" class="text-antique-text">${data.singlePolicy.interactions?.votes?.disagree?.count || 0}</strong></span>
            </div>
        </div>

        <!-- Voting Interaction Section -->
        <form id="formData" class="pt-6 border-t border-antique-border font-sans flex flex-col gap-3">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-xs text-antique-muted font-medium uppercase tracking-wider">Cast Your Stance:</div>
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
                <button id="submitBtn" type="button" class="px-5 py-2 bg-antique-accent text-white rounded text-xs font-medium hover:bg-antique-accentHover transition-colors shadow-sm w-full sm:w-auto">
                    Submit Stance
                </button>
            </div>
            <p class="text-[11px] text-antique-muted italic text-center sm:text-left">Note: Once your vote or comment is submitted, it cannot be changed.</p>
            <p id="voteStatus" class="text-xs text-antique-muted text-center sm:text-left" role="status" aria-live="polite"></p>
        </form>
    </div>
    `
    
)
}
return data
}).then((data)=>{  
    // INTERACTION UPDATION CODE BLOCK

    
if(data.userVoted[0]==false){
    const submitBtn=document.getElementById("submitBtn")
    const voteForm=document.getElementById("formData")
    const voteStatus=document.getElementById("voteStatus")
    const voteInputs=[...voteForm.querySelectorAll("input[name='policy-vote']")]
    const counts={
        agree:Number(document.getElementById("agreeVoteCount").textContent),
        neutral:Number(document.getElementById("neutralVoteCount").textContent),
        disagree:Number(document.getElementById("disagreeVoteCount").textContent)
    }

    const renderCounts=()=>{
        document.getElementById("agreeVoteCount").textContent=counts.agree
        document.getElementById("neutralVoteCount").textContent=counts.neutral
        document.getElementById("disagreeVoteCount").textContent=counts.disagree
    }

    submitBtn.onclick=async(event)=>{
        event.preventDefault()
        if(submitBtn.disabled) return

        const selectedRadio=voteForm.querySelector("input[name='policy-vote']:checked")?.value
        if(!["agree","neutral","disagree"].includes(selectedRadio)){
            voteStatus.textContent="Please select a stance before submitting."
            voteStatus.className="text-xs text-rose-700 text-center sm:text-left"
            return
        }

        const rollbackVote=applyOptimisticVote(counts,selectedRadio)
        renderCounts()
        voteStatus.textContent="Submitting your stance…"
        voteStatus.className="text-xs text-antique-muted text-center sm:text-left"
        submitBtn.disabled=true
        voteInputs.forEach(input=>{input.disabled=true})
        submitBtn.textContent="Submitting…"

        try {
            const response=await fetch("/feedBack",{
                method:"POST",
                headers:{
                    "Authorization":`Bearer ${idToken}`,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    policyId:localStorage.getItem("policyID"),
                    requestType:selectedRadio
                })
            })
            const responseData=await response.json().catch(()=>({}))
            if(!response.ok){
                throw new Error(responseData.error || `Vote request failed (${response.status})`)
            }

            voteStatus.textContent="Your stance was recorded."
            voteStatus.className="text-xs text-emerald-700 text-center sm:text-left"
            submitBtn.textContent="Vote recorded"
        } catch(error) {
            rollbackVote()
            renderCounts()
            submitBtn.disabled=false
            voteInputs.forEach(input=>{input.disabled=false})
            submitBtn.textContent="Submit Stance"
            voteStatus.textContent=`Your vote could not be saved. ${error.message || "Please try again."}`
            voteStatus.className="text-xs text-rose-700 text-center sm:text-left"
            console.error("Vote submission failed:",error)
        }
    }
}
})
.catch(error=>showPolicyLoadError(policyArticle,error))

} else {
    // POLICY ARTICLE RENDERING SECTION FOR NON USERS
      const policyArticle=document.getElementById("policyArticle")
      commentPostSection.style.display="none"
fetch("/policyFetch",{method:"POST",body:JSON.stringify({"requestType":"singlePolicyFetchNon","policyID":localStorage.getItem("policyID")})}).then(res=>{return res.json()}).then(data=>
{
if(!data || !data._id) throw new Error(data?.error || data?.message || "Policy response was invalid")
policyArticle.insertAdjacentHTML("beforeend",
    `
   <div>
            
            <!-- Metadata Header -->
            <div class="flex flex-wrap items-center justify-between text-xs font-sans text-antique-muted mb-4 pb-4 border-b border-antique-border gap-2">
                <span class="uppercase tracking-wider px-2.5 py-1 bg-antique-bg border border-antique-border rounded font-medium text-antique-text">${data.category}</span>
                <span id="publishDate">Published on ${new Date(data.createdAt).toLocaleString()} &bull; Status: ${data.status} &bull; Views: ${data.viewCount ?? 0}</span>
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
                <span class="block text-antique-muted uppercase tracking-wider mb-2 font-semibold">Aggregate Public Stance</span>
                <div class="flex flex-wrap items-center gap-6 text-sm">
                    <span>Agree: <strong class="text-antique-text">${data.interactions?.votes?.agree?.count ?? 0}</strong></span>
                    <span>Neutral: <strong class="text-antique-text">${data.interactions?.votes?.neutral?.count ?? 0}</strong></span>
                    <span>Disagree: <strong class="text-antique-text">${data.interactions?.votes?.disagree?.count ?? 0}</strong></span>
                </div>
            </div>

    </div>
    `
)
renderComments(data)
enablePolicyChat(data._id)
})
.catch(error=>showPolicyLoadError(policyArticle,error))
  }
})
 
