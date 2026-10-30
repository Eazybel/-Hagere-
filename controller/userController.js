// Profile management and activity metrics
const mongoose=require("mongoose")
const userModel=require("../models/User")
const policyModel=require("../models/Policy")
const admin = require("firebase-admin")
const {getAuth} = require("firebase-admin/auth")
// USER UPDATER ROUTE
const userController=async(req,res)=>{
    if(req.headers.authorization){
       const token=req.headers.authorization.split("Bearer ")[1]
      const decodedToken=await getAuth().verifyIdToken(token)
      const trustedToken=decodedToken.uid
      const isUser=await userModel.findOne({"email":req.body.email})
const {name,email,avatar}=req.body
if(isUser){
console.log("user is already registered")
}else if(!isUser)
    try{
{
const newUser=new userModel({
    name:name,
    email:email,
    avatar:avatar
    })
    newUser.save().then(()=>console.log("user saved"))
}
    }catch(error){
        res.send(error)
    }
    res.send(req.body)
      }else if(req.headers.authorization){
       res.status(401).send("Unauthorized Request")
    }

}
// USER FETCHER ROUTE
const userFetch=(async(req,res)=>{
const userNumber=await userModel.countDocuments()
return res.status(200).json({count:userNumber})
})

const createProfileActivityController=({User,Policy})=>async(req,res,next)=>{
    try {
        if(!req.auth?.email){
            return res.status(403).json({error:"Authenticated account email required"})
        }

        const user=await User.findOne({email:req.auth.email}).select("name createdAt votesCast")
        if(!user){
            return res.status(404).json({error:"Citizen profile not found"})
        }

        const votes=[...(user.votesCast || [])].sort(
            (left,right)=>new Date(right.votedAt || 0)-new Date(left.votedAt || 0)
        )
        const validPolicyIds=[...new Set(votes
            .map(vote=>vote.policyId)
            .filter(policyId=>mongoose.Types.ObjectId.isValid(policyId)))]
        const policies=validPolicyIds.length
            ? await Policy.find({_id:{$in:validPolicyIds}})
                .select("title category summary").lean()
            : []
        const policiesById=new Map(policies.map(policy=>[String(policy._id),policy]))

        return res.status(200).json({
            profile:{
                name:user.name,
                memberSince:user.createdAt
            },
            totalVotes:votes.length,
            activity:votes.slice(0,20).map(vote=>{
                const policy=policiesById.get(vote.policyId)
                return {
                    policyId:vote.policyId,
                    title:policy?.title || "Policy unavailable",
                    category:policy?.category || "",
                    summary:policy?.summary || "",
                    stance:vote.stance,
                    votedAt:vote.votedAt
                }
            })
        })
    } catch(error) {
        return next(error)
    }
}

const profileActivity=createProfileActivityController({User:userModel,Policy:policyModel})

module.exports={userController, userFetch, profileActivity, createProfileActivityController}