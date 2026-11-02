/**
 * @file policyController.js
 * @description Validates policy payloads, serializes public policy data, and handles policy catalog, detail, publishing, deletion, and counts.
 * @module Controllers/Policy
 * @requires mongoose and Policy/User models
 */
// Policy CRUD, search, and filtering logic
const mongoose=require("mongoose")
const policyModel=require("../models/Policy")
const userModel=require("../models/User")

/**
 * Normalizes Express JSON or text request bodies into an object.
 * @param {import("express").Request} req Request with a possibly JSON-string body.
 * @returns {object} Parsed request data or an empty object.
 * @throws {SyntaxError} When a text request body is malformed JSON.
 */
const requestData=(req)=>{
    if(req.body && typeof req.body==="object") return req.body
    if(typeof req.body==="string") return JSON.parse(req.body)
    return {}
}

/**
 * Removes private model data and formats policy engagement for browser clients.
 * @param {object} policy Mongoose document or plain policy object.
 * @param {?string} [currentUserId=null] Authenticated user's ID for their like state.
 * @returns {object} Public policy representation.
 */
const toPublicPolicy=(policy,currentUserId=null)=>{
    const data=policy.toObject ? policy.toObject() : policy
    const likes=Array.isArray(data.likes) ? data.likes : []
    return {
        _id:data._id,
        title:data.title,
        category:data.category,
        summary:data.summary,
        documentUrl:data.documentUrl || data.pdfUrl || "",
        pdfUrl:data.documentUrl || data.pdfUrl || "",
        status:data.status,
        totalVotes:data.totalVotes,
        viewCount:data.viewCount || 0,
        likesCount:likes.length,
        liked:Boolean(currentUserId && likes.some(userId=>userId.toString()===currentUserId)),
        createdAt:data.createdAt,
        interactions:{
            votes:{
                agree:{count:data.interactions?.votes?.agree?.count || 0},
                neutral:{count:data.interactions?.votes?.neutral?.count || 0},
                disagree:{count:data.interactions?.votes?.disagree?.count || 0}
            },
            comments:(data.interactions?.comments || []).map(comment=>({
                text:comment.text,
                createdAt:comment.createdAt
            }))
        }
    }
}

/**
 * Validates that a document link uses HTTP(S) and contains no embedded credentials.
 * @param {string} value Candidate document URL.
 * @returns {boolean} Whether the URL is acceptable.
 */
const isValidDocumentUrl=value=>{
    try{
        const url=new URL(value)
        return ["http:","https:"].includes(url.protocol) && !url.username && !url.password
    }catch{
        return false
    }
}

/**
 * Creates the admin policy publishing handler.
 * @param {object} dependencies Mongoose model dependencies.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @route POST /api/policies
 * @returns {import("express").RequestHandler} Handler returning 201 {policyId,documentUrl}, or 400/500 errors.
 */
const createPolicyUpdateController=({Policy})=>async(req,res)=>{
    const body=req.body || {}
    const title=typeof body.title==="string" ? body.title.trim() : ""
    const category=typeof body.category==="string" ? body.category.trim()
        : typeof body.sector==="string" ? body.sector.trim() : ""
    const summary=typeof body.description==="string" ? body.description.trim()
        : typeof body.summary==="string" ? body.summary.trim() : ""
    const documentUrl=typeof body.documentUrl==="string" ? body.documentUrl.trim()
        : typeof body.pdfUrl==="string" ? body.pdfUrl.trim() : ""

    if(!title || !category || !summary || !isValidDocumentUrl(documentUrl)){
        return res.status(400).json({
            error:"Policy title, category, description, and a valid documentUrl are required"
        })
    }

    // --- STEP 1: VALIDATE AND NORMALIZE THE JSON PUBLISHING PAYLOAD ---
    try{
        const newPolicy=new Policy({
            title,
            category,
            summary,
            documentUrl,
            status:typeof body.status==="string" ? body.status : "",
            totalVotes:0,
            viewCount:0,
            interactions:{
                votes:{
                    agree:{count:0,voters:[]},
                    neutral:{count:0,voters:[]},
                    disagree:{count:0,voters:[]}
                },
                comments:[]
            }
        })
        await newPolicy.save()
        return res.status(201).json({
            policyId:newPolicy.id || newPolicy._id,
            documentUrl
        })
    }catch(error){
        console.error("Policy could not be saved:",error)
        return res.status(500).json({error:"Policy could not be saved"})
    }
}

/** @route POST /api/policies @description Production policy publishing handler. */
const policyUpdate=createPolicyUpdateController({Policy:policyModel})
/**
 * Creates the admin policy deletion handler.
 * @route DELETE /api/policies/:id
 * @param {object} dependencies Mongoose models.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @param {import("mongoose").Model} dependencies.News News model whose relatedPolicy references are cleared.
 * @returns {import("express").RequestHandler} Handler returning 200 {success} or 400/404/500 errors.
 */
const createPolicyDeleteController=({Policy,News})=>async(req,res)=>{
    if(!mongoose.Types.ObjectId.isValid(req.params.id)){
        return res.status(400).json({success:false,error:"A valid policy ID is required"})
    }

    try{
        // Clear optional news references before deleting the policy to avoid stale relations.
        const policy=await Policy.findById(req.params.id)
        if(!policy) return res.status(404).json({success:false,error:"Policy not found"})

        await News.updateMany(
            {relatedPolicy:policy._id},
            {$set:{relatedPolicy:null}}
        )
        await Policy.findByIdAndDelete(req.params.id)
        return res.status(200).json({success:true})
    }catch(error){
        console.error("Policy deletion failed:",error.stack || error)
        return res.status(500).json({success:false,error:"Unable to delete policy right now"})
    }
}
/**
 * Creates the public policy catalog handler.
 * @param {object} dependencies Database models.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @param {import("mongoose").Model} dependencies.User User model used to calculate a viewer's like state.
 * @route GET /api/policies
 * @returns {import("express").RequestHandler} Handler returning 200 with a public policy array.
 * @throws {Error} For database failures forwarded to Express error middleware.
 */
const createPolicyListController=({Policy,User})=>async(req,res,next)=>{
    try{
        // Resolve viewer identity only when optional auth middleware attached a verified email.
        let currentUserId=null
        if(req.auth?.email && User){
            const user=await User.findOne({email:req.auth.email})
            currentUserId=user?._id?.toString() || null
        }
        const policies=await Policy.find().sort({createdAt:-1})
        res.set("Cache-Control","no-store")
        return res.status(200).json(policies.map(policy=>toPublicPolicy(policy,currentUserId)))
    }catch(error){
        return next(error)
    }
}
/** @route GET /api/policies @description Production public policy catalog handler. */
const policyList=createPolicyListController({Policy:policyModel,User:userModel})
/**
 * Creates the legacy policy detail/count handler used by the browser policy views.
 * @param {object} dependencies Database models.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @param {import("mongoose").Model} dependencies.User User model.
 * @route POST /policyFetch
 * @returns {import("express").RequestHandler} Handler returning public/detail policy payloads or 400/403/404 errors.
 */
const createPolicyFetchController=({Policy,User})=>async(req,res)=>{
    // Normalize legacy text bodies and branch by the page's explicit request type.
    const reqData=requestData(req)
    if(reqData.requestType==="policyDataFetch"){
        const allPolicies=await Policy.find().sort({createdAt:-1})
        res.set("Cache-Control","no-store")
        return res.status(200).json(allPolicies.map(toPublicPolicy))
    }
    if(reqData.requestType==="singlePolicyFetch" || reqData.requestType==="singlePolicyFetchNon"){
        if(reqData.requestType==="singlePolicyFetch" && !req.auth?.email){
            return res.status(403).json({error:"Verified account email required"})
        }
        const singlePolicy=await Policy.findByIdAndUpdate(
            reqData.policyID,
            {$inc:{viewCount:1}},
            {new:true}
        )
        if(!singlePolicy) return res.status(404).json({error:"Policy not found"})
        res.set("Cache-Control","no-store")

        if(reqData.requestType==="singlePolicyFetch"){
            const user=await User.findOne({email:req.auth.email})
            const userId=user?.id
            const votes=singlePolicy.interactions.votes
            const userVote=votes.agree.voters.includes(userId) ? [true,"agree"]
                : votes.neutral.voters.includes(userId) ? [true,"neutral"]
                : votes.disagree.voters.includes(userId) ? [true,"disagree"]
                : [false]
            return res.status(200).json({singlePolicy:toPublicPolicy(singlePolicy),userVoted:userVote})
        }

        return res.status(200).json(toPublicPolicy(singlePolicy))
    }
    return res.status(400).json({error:"Unsupported policy request"})
}
/** @route POST /policyFetch @description Production legacy policy detail/catalog handler. */
const policyFetch=createPolicyFetchController({Policy:policyModel,User:userModel})

/**
 * Returns the total number of policies to authorized administrators.
 * @route GET /admin/policyCount
 * @param {import("express").Request} req Authenticated admin request.
 * @param {import("express").Response} res Express response.
 * @returns {Promise<import("express").Response>} 200 with {count}.
 * @throws {Error} Database errors are handled by Express error middleware.
 */
const policyCount=async(req,res)=>{
const count=await policyModel.countDocuments()
return res.status(200).json({count})
}

module.exports={
    policyUpdate,
    policyFetch,
    policyList,
    policyCount,
    createPolicyUpdateController,
    createPolicyDeleteController,
    createPolicyListController,
    createPolicyFetchController
}
