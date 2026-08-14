// Support/Oppose/Neutral vote processing
const mongoose=require("mongoose")
const express=require("express")
const userModel=require("../models/User")
const policyModal=require("../models/Policy")
const feedBack=async(req,res)=>{
    const policy=await policyModal.findOne({"id":req.body.policyId})
    const requestBody=JSON.parse(req.body)
    if(requestBody.requestType=="agree"){
        policy.interactions.votes.agree.count=policy.interactions.votes.agree.count+1
       
 res.send(policy)
    }
  await policy.save().then(()=>console.log("interaction saved"))
   
}
module.exports=feedBack