const cloudinary=require("cloudinary").v2
const env=require("./env")
const multer=require("multer")
cloudinary.config({
    cloud_name:env.CLOUDINARY_CLOUD_NAME,
    api_secret:env.CLOUDINARY_SECRET,
    api_key:env.CLOUDINARY_KEY
})
const storage=multer.memoryStorage()
const upload=multer({storage})
module.exports={cloudinary, upload}