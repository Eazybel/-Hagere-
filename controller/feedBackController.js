// Support/Oppose/Neutral vote processing
const mongoose=require("mongoose")
const express=require("express")
const userModel=require("../models/User")
const policyModal=require("../models/Policy")
const feedBack=async(req,res)=>{
    const requestBody=JSON.parse(req.body)
    const policy=await policyModal.findOne({"_id":requestBody.policyId})
    const user=await userModel.findOne({"email":requestBody.userEmail})
    if(requestBody.requestType=="agree"){
        // policy.interactions.votes.agree.count=policy.interactions.votes.agree.count+1
        console.log(user.votesCast)
       
 res.send(user)
    }
//   await policy.save().then(()=>console.log("interaction saved"))
   
}
module.exports=feedBack