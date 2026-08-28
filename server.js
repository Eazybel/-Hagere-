//  Varible initiation
const express=require("express")
const path=require("path")
const mongoose=require("mongoose")
const cors=require("cors")
const rateLimiter=require("express-rate-limit")
const admin=require("firebase-admin")
var {cert,initializeApp} = require("firebase-admin/app");
const {cloudinary, upload}=require("./utils/cloudinary")

// var serviceAccount = require("./serviceAccount.json");
var serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
// const limiter=rateLimiter({
//     windowMs:15*60*1000,
//     malimit:5,
//     message:"Too many Requests"
// })
admin.initializeApp({
    credential:cert(serviceAccount)
})
// CONTROLLER ROUTE
const {userController, userFetch}=require("./controller/userController")
const {policyUpdate,policyFetch}=require("./controller/policyController")
const feedBack=require("./controller/feedBackController")
// Package initiation
const app=express()
app.use(express.static(path.join(__dirname,"public")))
app.use(express.json())
app.use(express.text())
app.use(express.urlencoded({extended:true}))
require("dotenv").config()
const port=process.env.PORT
const connectionString=process.env.CONNECTION_STRING
// CORS POLICY MIDDLWARE
const corsConfig={
    origin:"http://127.0.0.1/",
    optionsSuccessStatus:200

}
app.use(cors(corsConfig))
// Server listening port
app.get("/admin",(req,res)=>{
    res.sendFile(path.join(__dirname,"/admin.html"))
})
//ROUTE INITIALIZATION
app.post("/policyUpdate",upload.single("file"),policyUpdate)
app.post("/newUserRegister",userController)
app.post("/policyFetch",policyFetch)
app.post("/userFetch",userFetch)
app.post("/feedBack",feedBack)
app.listen(port,()=>{
    console.log("Server listening")
})

// Database Connection initialization with mongo db
mongoose.connect(connectionString)
.then(()=>
    {console.log("Database Connection started")}
).catch(err=>{
    console.log(err)
})
// 