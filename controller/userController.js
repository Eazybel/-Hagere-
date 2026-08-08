// Profile management and activity metrics
const mongoose=require("mongoose")
const userModel=require("../models/User")
const userController=async(req,res)=>{
// const isUser=await userModel.findOne({"email":req.body.email})
const {name,email,avatar}=req.body
// if(isUser){
// console.log("user")
// }else if(!isUser){
//     console.log("not user")
// }
    // const newUserr=new userModel({

    // })
    res.send(req.body)
}
module.exports=userController