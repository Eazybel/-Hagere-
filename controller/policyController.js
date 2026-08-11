// Policy CRUD, search, and filtering logic
const {cloudinary, upload}=require("../utils/cloudinary")
const policyUpdate=((req,res)=>{
    if(!req.file){
    res.status(404).send("File upload not found")
    }
    try{
const uploadStream=cloudinary.uploader.upload_stream({
    folder:"policyFiles",
    resource_type:"auto"

},(error,result)=>{
    if(error){
        res.send(401).send(error)
    }
    res.status(200).json(result)
})
uploadStream.end(req.file.buffer)
    }catch(error){
console.log(error)
    }
// res.json(req.file)
})
module.exports=policyUpdate
