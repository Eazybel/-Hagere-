/**
 * @file userController.js
 * @description Verifies Firebase user registration, exposes admin user counts, and serves citizen profile activity.
 * @module Controllers/Users
 * @requires mongoose, firebase-admin, User and Policy models
 */
// Profile management and activity metrics
const mongoose=require("mongoose")
const userModel=require("../models/User")
const policyModel=require("../models/Policy")
const admin = require("firebase-admin")
const {getAuth} = require("firebase-admin/auth")
const invalidTokenErrorCodes=new Set([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/user-disabled",
    "auth/user-not-found"
])

/**
 * Creates the Firebase-backed citizen registration handler.
 * @param {object} options User model and an injectable ID-token verifier.
 * @returns {import("express").RequestHandler} Handler for POST /newUserRegister.
 */
function createUserController({
    User,
    verifyIdToken=token=>getAuth().verifyIdToken(token,true)
}) {
    /**
     * @route POST /newUserRegister
     * @param {import("express").Request} req Bearer Firebase ID token and optional profile name/avatar body.
     * @param {import("express").Response} res Express response.
     * @param {import("express").NextFunction} next Forwards unexpected verifier/database errors.
     * @returns {Promise<void>} Responds with 200/201 profile, 400 validation, 401 invalid credentials, or 403 unverified email.
     */
    return async(req,res,next)=>{
        const authorization=req.get?.("authorization") || req.headers?.authorization
        const match=typeof authorization==="string"
            ? authorization.match(/^Bearer\s+(.+)$/i)
            : null
        if(!match){
            return res.status(401).json({success:false,error:"Authentication required"})
        }

        let decodedToken
        try{
            decodedToken=await verifyIdToken(match[1].trim())
        }catch(error){
            if(invalidTokenErrorCodes.has(error.code)){
                return res.status(401).json({success:false,error:"Invalid or expired authentication token"})
            }
            return next(error)
        }

        const email=typeof decodedToken.email==="string"
            ? decodedToken.email.trim().toLowerCase()
            : ""
        if(!email){
            return res.status(401).json({success:false,error:"Verified account email required"})
        }
        if(decodedToken.email_verified!==true){
            return res.status(403).json({success:false,error:"Verified citizen account required"})
        }

        try{
            const existingUser=await User.findOne({email})
            if(existingUser){
                return res.status(200).json({
                    success:true,
                    user:{
                        id:existingUser.id || existingUser._id,
                        name:existingUser.name,
                        email:existingUser.email
                    }
                })
            }

            const name=typeof decodedToken.name==="string" && decodedToken.name.trim()
                ? decodedToken.name.trim()
                : typeof req.body?.name==="string" ? req.body.name.trim() : ""
            if(!name){
                return res.status(400).json({success:false,error:"A profile name is required"})
            }
            const avatar=typeof decodedToken.picture==="string"
                ? decodedToken.picture
                : typeof req.body?.avatar==="string" ? req.body.avatar : ""

            const user=new User({name,email,avatar})
            await user.save()
            return res.status(201).json({
                success:true,
                user:{id:user.id || user._id,name:user.name,email:user.email}
            })
        }catch(error){
            if(error.code===11000){
                const existingUser=await User.findOne({email})
                if(existingUser){
                    return res.status(200).json({
                        success:true,
                        user:{
                            id:existingUser.id || existingUser._id,
                            name:existingUser.name,
                            email:existingUser.email
                        }
                    })
                }
            }
            return next(error)
        }
    }
}

/** @route POST /newUserRegister @description Production Firebase-backed citizen registration handler. */
const userController=createUserController({User:userModel})
/**
 * Returns the registered-user count for authorized admin dashboards.
 * @route POST /userFetch
 * @param {import("express").Request} req Admin request.
 * @param {import("express").Response} res Express response.
 * @returns {Promise<import("express").Response>} 200 JSON {count}.
 */
const userFetch=(async(req,res)=>{
const userNumber=await userModel.countDocuments()
return res.status(200).json({count:userNumber})
})

/**
 * Creates the citizen activity endpoint handler.
 * @param {object} dependencies Mongoose models.
 * @param {import("mongoose").Model} dependencies.User User model.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @returns {import("express").RequestHandler} Handler for GET /profile/activity.
 */
const createProfileActivityController=({User,Policy})=>async(req,res,next)=>{
    /**
     * Returns the current citizen profile and their 20 most recent recorded votes.
     * @route GET /profile/activity
     * @param {import("express").Request} req Verified citizen email in req.auth.
     * @param {import("express").Response} res Express response.
     * @param {import("express").NextFunction} next Forwards database failures.
     * @returns {Promise<import("express").Response>} 200 profile, totalVotes, and activity; missing identity/profile returns 403/404.
     */
    try {
        if(!req.auth?.email){
            return res.status(403).json({error:"Authenticated account email required"})
        }

        const user=await User.findOne({email:req.auth.email}).select("name createdAt votesCast")
        if(!user){
            return res.status(404).json({error:"Citizen profile not found"})
        }

        const votes=[...(user.votesCast || [])].sort(
            (left,right)=>new Date(right.votedAt || 0)-new Date(left.votedAt || 0)
        )
        const validPolicyIds=[...new Set(votes
            .map(vote=>vote.policyId)
            .filter(policyId=>mongoose.Types.ObjectId.isValid(policyId)))]
        const policies=validPolicyIds.length
            ? await Policy.find({_id:{$in:validPolicyIds}})
                .select("title category summary").lean()
            : []
        const policiesById=new Map(policies.map(policy=>[String(policy._id),policy]))

        return res.status(200).json({
            profile:{
                name:user.name,
                memberSince:user.createdAt
            },
            totalVotes:votes.length,
            activity:votes.slice(0,20).map(vote=>{
                const policy=policiesById.get(vote.policyId)
                return {
                    policyId:vote.policyId,
                    title:policy?.title || "Policy unavailable",
                    category:policy?.category || "",
                    summary:policy?.summary || "",
                    stance:vote.stance,
                    votedAt:vote.votedAt
                }
            })
        })
    } catch(error) {
        return next(error)
    }
}

/** @route GET /profile/activity @description Production citizen profile activity handler. */
const profileActivity=createProfileActivityController({User:userModel,Policy:policyModel})

module.exports={userController, userFetch, profileActivity, createProfileActivityController, createUserController}