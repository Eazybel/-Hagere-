const cloudinary=require("cloudinary").v2
require("dotenv").config()
const multer=require("multer")
cloudinary.config({
    cloud_name:"dgietnwua",
    api_secret:process.env.CLOUDINARY_SECRET,
    api_key:process.env.CLOUDINARY_KEY
})
const storage=multer.memoryStorage()
const upload=multer({storage})
module.exports={cloudinary, upload}