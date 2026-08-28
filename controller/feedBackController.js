// Support/Oppose/Neutral vote processing
const mongoose=require("mongoose")
const express=require("express")
const userModel=require("../models/User")
const policyModal=require("../models/Policy")
const feedBack=async(req,res)=>{
    const requestBody=JSON.parse(req.body)
    const policy=await policyModal.findOne({"_id":requestBody.policyId})
    const user=await userModel.findOne({"email":requestBody.userEmail})
    policy.totalVotes=policy.totalVotes+1
    if(requestBody.requestType=="agree"){
        policy.interactions.votes.agree.count=policy.interactions.votes.agree.count+1
        user.votesCast.unshift({policyId:requestBody.policyId,stance:"agree"})
       policy.interactions.votes.agree.voters.unshift(user.id)
       
    }else if(requestBody.requestType=="neutral"){
         policy.interactions.votes.neutral.count=policy.interactions.votes.neutral.count+1
        user.votesCast.unshift({policyId:requestBody.policyId,stance:"neutral"})
       policy.interactions.votes.neutral.voters.unshift(user.id)
    }else if(requestBody.requestType=="disagree"){
         policy.interactions.votes.disagree.count=policy.interactions.votes.disagree.count+1
        user.votesCast.unshift({policyId:requestBody.policyId,stance:"disagree"})
       policy.interactions.votes.disagree.voters.unshift(user.id)
    }
    await policy.save().then(()=>console.log("interaction saved"))
    await user.save().then(()=>console.log("user Data Updated"))
    res.status(200).send(user)
   
}
module.exports=feedBack