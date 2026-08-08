// Profile management and activity metrics
const mongoose=require("mongoose")
const userModel=require("../models/User")
const admin = require("firebase-admin")

const userController=async(req,res)=>{
    if(req.headers.authorization){
       console.log(req.headers.authorization)
    }else if(req.headers.authorizatio){
        console.log("no authorization")
    }
// const isUser=await userModel.findOne({"email":req.body.email})
// const {name,email,avatar}=req.body
// if(isUser){
// console.log("user is already registered")
// }else if(!isUser){
// const newUser=new userModel({
//     name:name,
//     email:email,
//     avatar:avatar
//     })
//     newUser.save().then(()=>console.log("user saved"))
// }
//     res.send(req.body)
}
module.exports=userController