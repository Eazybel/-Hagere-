/**
 * @file feedBackController.js
 * @description Records a citizen's one-time agree, neutral, or disagree vote on a policy.
 * @module Controllers/PolicyVotes
 * @requires mongoose and User and Policy models
 */
// Support/Oppose/Neutral vote processing
const mongoose=require("mongoose")
const userModel=require("../models/User")
const policyModal=require("../models/Policy")

/**
 * Builds a validated policy voting handler.
 * @param {object} dependencies Database models.
 * @param {import("mongoose").Model} dependencies.User User model.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @returns {import("express").RequestHandler} Handler for POST /feedBack.
 */
function createFeedBackController({User, Policy}) {
    /**
     * @route POST /feedBack
     * @param {import("express").Request} req JSON {policyId, requestType} and verified account email in auth.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 {success, totalVotes}; invalid, duplicate, unauthenticated, and missing records use 400/403/404/409.
     */
    return async(req,res)=>{
        let requestBody=req.body
        if(typeof requestBody==="string"){
            try{
                requestBody=JSON.parse(requestBody)
            }catch{
                return res.status(400).json({error:"Invalid vote request body"})
            }
        }
        if(!requestBody || typeof requestBody!=="object"
            || !["agree","neutral","disagree"].includes(requestBody.requestType)){
            return res.status(400).json({error:"A valid voting stance is required"})
        }
        if(!mongoose.Types.ObjectId.isValid(requestBody.policyId)){
            return res.status(400).json({error:"A valid policy ID is required"})
        }
        if(!req.auth?.email){
            return res.status(403).json({error:"Verified account email required"})
        }

        const user=await User.findOne({email:req.auth.email})
        if(!user) return res.status(404).json({error:"Registered citizen not found"})

        // --- STEP 1: ATOMICALLY RECORD ONE STANCE, THEN MIRROR IT IN THE USER ACTIVITY ---
        const stance=requestBody.requestType
        const votePath=`interactions.votes.${stance}`
        const voterId=user.id
        const policy=await Policy.findOneAndUpdate({
            _id:requestBody.policyId,
            $and:[
                {"interactions.votes.agree.voters":{$ne:voterId}},
                {"interactions.votes.neutral.voters":{$ne:voterId}},
                {"interactions.votes.disagree.voters":{$ne:voterId}}
            ]
        },{
            $inc:{totalVotes:1,[`${votePath}.count`]:1},
            $addToSet:{[`${votePath}.voters`]:voterId}
        },{new:true})
        if(!policy){
            const exists=await Policy.exists({_id:requestBody.policyId})
            return exists
                ? res.status(409).json({error:"A vote has already been recorded for this policy"})
                : res.status(404).json({error:"Policy not found"})
        }

        await User.updateOne(
            {_id:user._id},
            {$push:{votesCast:{policyId:String(policy._id),stance}}}
        )
        return res.status(200).json({success:true,totalVotes:policy.totalVotes})
    }
}

module.exports=createFeedBackController({User:userModel,Policy:policyModal})
module.exports.createFeedBackController=createFeedBackController