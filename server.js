//  Varible initiation
const env = require("./utils/env")
const express=require("express")
const path=require("path")
const mongoose=require("mongoose")
const cors=require("cors")
const rateLimiter=require("express-rate-limit")
const admin=require("firebase-admin")
var {cert,initializeApp} = require("firebase-admin/app");
const {cloudinary, upload}=require("./utils/cloudinary")

// var serviceAccount = require("./serviceAccount.json");
var serviceAccount = env.SERVICE_ACCOUNT;
// const limiter=rateLimiter({
//     windowMs:15*60*1000,
//     malimit:5,
//     message:"Too many Requests"
// })
admin.initializeApp({
    credential:cert(serviceAccount)
})
initializeApp({
    credential:cert(env.ADMIN_SERVICE_ACCOUNT),
    projectId:env.ADMIN_FIREBASE_PROJECT_ID
},"admin-auth")
// CONTROLLER ROUTE
const {userController, userFetch}=require("./controller/userController")
const {policyUpdate,policyFetch,policyCount}=require("./controller/policyController")
const feedBack=require("./controller/feedBackController")
const {createAnalyticsController}=require("./controller/analyticsController")
const {authorizeRoles}=require("./middleware/auth")
// Package initiation
const app=express()
app.use(express.static(path.join(__dirname,"public")))
app.use(express.json())
app.use(express.text())
app.use(express.urlencoded({extended:true}))
const port=env.PORT
const connectionString=env.CONNECTION_STRING
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
app.post("/policyUpdate",authorizeRoles("admin"),upload.single("file"),policyUpdate)
app.post("/newUserRegister",userController)
app.post("/policyFetch",(req,res,next)=>{
    let requestType=req.body?.requestType
    if(typeof req.body==="string"){
        try {
            requestType=JSON.parse(req.body).requestType
        } catch {
            return next()
        }
    }
    if(requestType==="singlePolicyFetch"){
        return authorizeRoles("citizen","admin")(req,res,next)
    }
    return next()
},policyFetch)
app.get("/admin/policyCount",authorizeRoles("admin"),policyCount)
app.get("/admin/analytics",authorizeRoles("admin"),createAnalyticsController({
    Policy:require("./models/Policy"),
    User:require("./models/User")
}))
app.post("/userFetch",authorizeRoles("admin"),userFetch)
app.post("/feedBack",authorizeRoles("citizen"),feedBack)
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