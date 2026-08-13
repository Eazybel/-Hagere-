// Policy CRUD, search, and filtering logic
const {cloudinary, upload}=require("../utils/cloudinary")
const policyModel=require("../models/Policy")
const policyUpdate=(async(req,res)=>{
    if(!req.file){
    res.status(404).send("File upload not found")
    }
    try{
const uploadStream=cloudinary.uploader.upload_stream({
    folder:"policyFiles",
    resource_type:"auto"

},async(error,result)=>{
    if(error){
        res.send(401).send(error)
    }
    const newPolicy=new policyModel({
    title:req.body.title,
    category:req.body.sector,
    summary:req.body.description,
    pdfUrl:result.url,
    status:req.body.status
})
await newPolicy.save().then(()=>console.log("saved"))
    res.status(200).json(result)
})
uploadStream.end(req.file.buffer)
    }catch(error){
console.log(error)
    }

})
const policyFetch=async(req,res)=>{
    const allPolicies=await policyModel.find()
    const reqData=JSON.parse(req.body)
   if(reqData.requestType=="policyNumberFetch"){
    res.status(200).send(allPolicies.length)
   }else if(reqData.requestType=="policyDataFetch"){

       res.status(200).json(allPolicies)
   }else if(reqData.requestType=="singlePolicyFetch"){
    const singlePolicy=await policyModel.findOne({"_id":reqData.policyID})
        res.status(200).json(singlePolicy)
   }

}
module.exports={policyUpdate, policyFetch}
