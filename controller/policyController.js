// Policy CRUD, search, and filtering logic
const {cloudinary, upload}=require("../utils/cloudinary")
const policyModel=require("../models/Policy")
const userModel=require("../models/User")

const requestData=(req)=>{
    if(req.body && typeof req.body==="object") return req.body
    if(typeof req.body==="string") return JSON.parse(req.body)
    return {}
}

const toPublicPolicy=(policy)=>{
    const data=policy.toObject ? policy.toObject() : policy
    return {
        _id:data._id,
        title:data.title,
        category:data.category,
        summary:data.summary,
        pdfUrl:data.pdfUrl,
        status:data.status,
        totalVotes:data.totalVotes,
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

const policyUpdate=(async(req,res)=>{
    if(!req.file){
        return res.status(400).send("File upload not found")
    }
    try{
const uploadStream=cloudinary.uploader.upload_stream({
    folder:"policyFiles",
    resource_type:"auto"

},async(error,result)=>{
    if(error){
        return res.status(502).json({error:"Policy document upload failed"})
    }
    if(!result) return res.status(502).json({error:"Policy document upload returned no result"})
    const newPolicy=new policyModel({
    title:req.body.title,
    category:req.body.sector,
    summary:req.body.description,
    pdfUrl:result.url,
    status:req.body.status
})
await newPolicy.save().then(()=>console.log("saved"))
res.status(201).json({policyId:newPolicy.id,pdfUrl:result.secure_url || result.url})
})
uploadStream.end(req.file.buffer)
}catch(error){
    return res.status(500).json({error:"Policy could not be published"})
}

})
const policyFetch=async(req,res)=>{
const reqData=requestData(req)
if(reqData.requestType==="policyDataFetch"){
    const allPolicies=await policyModel.find()
    return res.status(200).json(allPolicies.map(toPublicPolicy))
}
if(reqData.requestType==="singlePolicyFetch" || reqData.requestType==="singlePolicyFetchNon"){
    const singlePolicy=await policyModel.findById(reqData.policyID)
    if(!singlePolicy) return res.status(404).json({error:"Policy not found"})

    if(reqData.requestType==="singlePolicyFetch"){
        if(!req.auth?.email) return res.status(403).json({error:"Verified account email required"})
        const user=await userModel.findOne({email:req.auth.email})
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

const policyCount=async(req,res)=>{
const count=await policyModel.countDocuments()
return res.status(200).json({count})
}

module.exports={policyUpdate, policyFetch, policyCount}
