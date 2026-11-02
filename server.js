/**
 * @file server.js
 * @description Initializes Firebase Admin, configures the Express application and API routes, and opens the MongoDB connection for Hagere V1.
 * @module Server
 * @requires express, mongoose, cors, firebase-admin, and internal controllers, routes, middleware, models, and environment utilities
 */
//  Varible initiation
const env = require("./utils/env")
const express=require("express")
const path=require("path")
const mongoose=require("mongoose")
const cors=require("cors")
const admin=require("firebase-admin")
var {cert,initializeApp} = require("firebase-admin/app");
const {authRateLimit, voteRateLimit, policyWriteRateLimit, policyChatRateLimit, policyChatPollRateLimit}=require("./controller/rateLimitController")
const {notFoundHandler, errorHandler}=require("./middleware/errorHandler")

// var serviceAccount = require("./serviceAccount.json");
var serviceAccount = env.SERVICE_ACCOUNT;
admin.initializeApp({
    credential:cert(serviceAccount)
})
initializeApp({
    credential:cert(env.ADMIN_SERVICE_ACCOUNT),
    projectId:env.ADMIN_FIREBASE_PROJECT_ID
},"admin-auth")
// CONTROLLER ROUTE
// --- STEP 1: LOAD ROUTE HANDLERS AND SECURITY MIDDLEWARE ---
const {userController, userFetch, profileActivity}=require("./controller/userController")
const {
    policyUpdate,
    policyFetch,
    policyList,
    policyCount,
    createPolicyDeleteController
}=require("./controller/policyController")
const {createPolicyChatController}=require("./controller/policyChatController")
const policyComment=require("./controller/commentController")
const feedBack=require("./controller/feedBackController")
const {createAnalyticsController}=require("./controller/analyticsController")
const {authorizeRoles}=require("./middleware/auth")
const newsRoutes=require("./routes/newsRoutes")
const {createPolicyLikeController}=require("./controller/policyLikeController")
// Package initiation
// --- STEP 2: CONFIGURE STATIC ASSETS, BODY PARSERS, AND CORS ---
const app=express()
app.use(express.static(path.join(__dirname,"public")))
app.use(express.json())
app.use(express.text())
app.use(express.urlencoded({extended:true}))
const port=env.PORT
const connectionString=env.CONNECTION_STRING
// CORS POLICY MIDDLWARE
// --- STEP 3: APPLY CROSS-ORIGIN POLICY ---
const corsConfig={
    origin:"http://127.0.0.1/",
    optionsSuccessStatus:200

}
app.use(cors(corsConfig))
// Server listening port
// --- STEP 4: REGISTER PUBLIC, CITIZEN, AND ADMIN ROUTES ---
/**
 * @route GET /admin
 * @description Serves the administrator HTML entry point.
 * @param {import("express").Request} req Incoming request.
 * @param {import("express").Response} res Express response.
 * @returns {void} Sends the admin page.
 */
app.get("/admin",(req,res)=>{
    res.sendFile(path.join(__dirname,"/admin.html"))
})
//ROUTE INITIALIZATION
// Anonymous requests cannot create an account: userController verifies Firebase ID tokens.
/**
 * @route POST /newUserRegister
 * @description Registers or synchronizes a citizen profile from a verified Firebase ID token.
 * @param {object} req.body Optional display name and avatar.
 * @returns {200|201} JSON {success, user}; validation/authentication failures use 400/401/403.
 */
app.post("/newUserRegister",authRateLimit,userController)
/**
 * Allows anonymous policy catalog reads while validating a supplied identity token.
 * @param {import("express").Request} req Incoming request; an optional Bearer token is read from Authorization.
 * @param {import("express").Response} res Express response.
 * @param {import("express").NextFunction} next Continues to catalog handling or authentication error handling.
 * @returns {void} Calls next middleware.
 * @throws {Error} For unexpected token verification failures delegated to Express.
 */
const optionalPolicyFeedAuth=(req,res,next)=>{
    if(!req.get("authorization")) return next()
    return authorizeRoles("citizen","admin")(req,res,next)
}
/**
 * @route GET /api/policies
 * @description Lists public policies with optional caller-specific like state.
 * @returns {200} Array of public policy objects; unexpected failures use Express error handling.
 */
app.get("/api/policies",optionalPolicyFeedAuth,policyList)
/**
 * @route POST /api/policies
 * @description Creates a policy as an administrator.
 * @param {object} req.body {title, category, description, documentUrl, status?}.
 * @returns {201} JSON {policyId, documentUrl}; errors use 400/401/403/500.
 */
app.post("/api/policies",policyWriteRateLimit,authorizeRoles("admin"),policyUpdate)
/**
 * @route DELETE /api/policies/:id
 * @description Deletes a policy and clears dependent news references; administrators only.
 * @param {string} req.params.id Policy ObjectId.
 * @returns {200} JSON {success}; errors use 400/401/403/404/500.
 */
app.delete("/api/policies/:id",authorizeRoles("admin"),createPolicyDeleteController({
    Policy:require("./models/Policy"),
    News:require("./models/News")
}))
/**
 * @route POST /api/policies/:id/like
 * @description Toggles the authenticated citizen's policy like.
 * @param {string} req.params.id Policy ObjectId.
 * @returns {200} JSON {success, liked, likesCount}; errors use 400/401/403/404/500.
 */
app.post("/api/policies/:id/like",voteRateLimit,authorizeRoles("citizen"),createPolicyLikeController({
    Policy:require("./models/Policy"),
    User:require("./models/User")
}))
app.use("/api/news",newsRoutes)
const policyChatController=createPolicyChatController({
    Policy:require("./models/Policy"),
    apiKey:env.GEMINI_API_KEY
})
/**
 * @route POST /api/policies/:id/chat
 * @description Submits a policy-grounded Gemini prompt.
 * @param {string} req.params.id Policy ObjectId.
 * @param {object} req.body {message}.
 * @returns {200} JSON {success, reply}; errors include 400/413/500/502/503/504.
 */
app.post("/api/policies/:id/chat",policyChatRateLimit,policyChatController.create)
/**
 * @route GET /api/policies/:id/chat/:interactionId
 * @description Polls the asynchronous Gemini interaction status.
 * @param {string} req.params.id Policy ObjectId.
 * @param {string} req.params.interactionId Provider interaction ID.
 * @returns {200} Completed answer or 202 pending; errors include 400/502/503/504.
 */
app.get("/api/policies/:id/chat/:interactionId",policyChatPollRateLimit,policyChatController.poll)
/**
 * @route POST /policyFetch
 * @description Legacy policy catalog/detail fetch; authenticated detail requests require citizen/admin role.
 * @param {object} req.body requestType and optional policyID.
 * @returns {200} Policy data; unsupported requests use 400, invalid identity uses 403, missing policy uses 404.
 */
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
/**
 * @route GET /admin/policyCount
 * @description Returns total policy count to administrators.
 * @returns {200} JSON {count}; authentication/authorization failures use 401/403.
 */
app.get("/admin/policyCount",authorizeRoles("admin"),policyCount)
/**
 * @route GET /admin/analytics
 * @description Returns aggregate engagement metrics to administrators.
 * @returns {200} JSON {generatedAt, overview, topPolicies}; failures use 401/403/500.
 */
app.get("/admin/analytics",authorizeRoles("admin"),createAnalyticsController({
    Policy:require("./models/Policy"),
    User:require("./models/User")
}))
// USER FETCHER ROUTE
/**
 * @route POST /userFetch
 * @description Returns total registered-user count to administrators.
 * @returns {200} JSON {count}; authentication/authorization failures use 401/403.
 */
app.post("/userFetch",authorizeRoles("admin"),userFetch)
/**
 * @route GET /profile/activity
 * @description Returns the current citizen profile and recent vote activity.
 * @returns {200} JSON {profile, totalVotes, activity}; errors use 401/403/404/500.
 */
app.get("/profile/activity",authorizeRoles("citizen"),profileActivity)
/**
 * @route POST /feedBack
 * @description Records an authenticated citizen policy vote.
 * @param {object} req.body {policyId, requestType}.
 * @returns {200} JSON {success, totalVotes}; errors use 400/401/403/404/409/500.
 */
app.post("/feedBack",voteRateLimit,authorizeRoles("citizen"),feedBack)
/**
 * @route POST /policyComment
 * @description Adds an authenticated citizen policy comment.
 * @param {object} req.body {policyId, text}.
 * @returns {201} JSON {success, comment}; errors use 400/401/403/404.
 */
app.post("/policyComment",voteRateLimit,authorizeRoles("citizen"),policyComment)
app.use(notFoundHandler)
app.use(errorHandler)
app.listen(port,()=>{
    console.log("Server listening")
})

// Database Connection initialization with mongo db
// --- STEP 5: CONNECT TO MONGODB AFTER ROUTES ARE READY ---
// Keep startup errors visible; this connection is required by request handlers.
mongoose.connect(connectionString)
.then(()=>
    {console.log("Database Connection started")}
).catch(err=>{
    console.log(err)
})
// 