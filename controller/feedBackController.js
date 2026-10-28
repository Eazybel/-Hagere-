// Support/Oppose/Neutral vote processing
const userModel=require("../models/User")
const policyModal=require("../models/Policy")
const feedBack=async(req,res)=>{
    let requestBody=req.body
    if(typeof requestBody==="string") requestBody=JSON.parse(requestBody)
    if(!["agree","neutral","disagree"].includes(requestBody.requestType)){
        return res.status(400).json({error:"A valid voting stance is required"})
    }
    if(!req.auth?.email){
        return res.status(403).json({error:"Verified account email required"})
    }

    const user=await userModel.findOne({email:req.auth.email})
    if(!user) return res.status(404).json({error:"Registered citizen not found"})

    const stance=requestBody.requestType
    const votePath=`interactions.votes.${stance}`
    const voterId=user.id
    const policy=await policyModal.findOneAndUpdate({
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
        const exists=await policyModal.exists({_id:requestBody.policyId})
        return exists
            ? res.status(409).json({error:"A vote has already been recorded for this policy"})
            : res.status(404).json({error:"Policy not found"})
    }

    await userModel.updateOne(
        {_id:user._id},
        {$push:{votesCast:{policyId:String(policy._id),stance}}}
    )
    return res.status(200).json({success:true,totalVotes:policy.totalVotes})
}
module.exports=feedBack