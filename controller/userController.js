// Profile management and activity metrics
const mongoose=require("mongoose")
const userModel=require("../models/User")
const userController=async(req,res)=>{
    const newUser=new userModel({

    })
    res.send(req.body)
}
module.exports=userController