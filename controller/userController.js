// Profile management and activity metrics
const mongoose=require("mongoose")
const userModel=require("../models/User")
const admin = require("firebase-admin")
const {getAuth} = require("firebase-admin/auth")

const userController=async(req,res)=>{
    if(req.headers.authorization){
       const token=req.headers.authorization.split("Bearer ")[1]
      const decodedToken=await getAuth().verifyIdToken(token)
      const trustedToken=decodedToken.uid
      const isUser=await userModel.findOne({"email":req.body.email})
const {name,email,avatar}=req.body
if(isUser){
console.log("user is already registered")
}else if(!isUser){
const newUser=new userModel({
    name:name,
    email:email,
    avatar:avatar
    })
    newUser.save().then(()=>console.log("user saved"))
}
    res.send(req.body)
      }else if(req.headers.authorization){
       res.status(401).send("Unauthorized Request")
    }

}
module.exports=userController