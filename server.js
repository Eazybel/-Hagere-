//  Varible initiation
const express=require("express")
const path=require("path")
const mongoose=require("mongoose")
const cors=require("cors")
var {cert,initializeApp} = require("firebase-admin/app");

var serviceAccount = require("./serviceAccount.json");

initializeApp({
    credential:cert(serviceAccount)
})
// CONTROLLER ROUTE
const newUserRegister=require("./controller/userController")
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
app.post("/newUserRegister",newUserRegister)
app.listen(port,()=>{
    console.log("Server listening")
})

// Database Connection initialization
mongoose.connect(connectionString)
.then(()=>
    {console.log("Database Connection started")}
).catch(err=>{
    console.log(err)
})
// 