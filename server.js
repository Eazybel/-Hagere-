//  Varible initiation
const express=require("express")
const path=require("path")
const mongoose=require("mongoose")
// Package initiation
const app=express()
app.use(express.static(path.join(__dirname,"public")))
app.use(express.json())
app.use(express.text())
app.use(express.urlencoded({extended:true}))
require("dotenv").config()
const port=process.env.PORT
const connectionString=process.env.CONNECTION_STRING
// Server listening port
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