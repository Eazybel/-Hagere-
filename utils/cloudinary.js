/**
 * @file cloudinary.js
 * @description Configures the Cloudinary SDK and an in-memory Multer upload middleware from validated environment settings.
 * @module Utils/Cloudinary
 * @requires cloudinary, multer, and local environment configuration
 */
const cloudinary=require("cloudinary").v2
const env=require("./env")
const multer=require("multer")
cloudinary.config({
    cloud_name:env.CLOUDINARY_CLOUD_NAME,
    api_secret:env.CLOUDINARY_SECRET,
    api_key:env.CLOUDINARY_KEY
})
// Memory storage avoids writing transient upload buffers to the application filesystem.
const storage=multer.memoryStorage()
const upload=multer({storage})
module.exports={cloudinary, upload}