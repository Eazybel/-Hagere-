/**
 * @file User.js
 * @description Defines citizen profiles, unique email identity, activity votes, and account active state.
 * @module Models/User
 * @requires mongoose
 */
const mongoose = require("mongoose")

// Vote activity is embedded without a separate subdocument ID.
const voteSchema = new mongoose.Schema({
    // String policy ObjectId snapshot (not a Mongoose ref); optional for legacy records.
    policyId: String,
    // String stance value; current vote route accepts agree, neutral, or disagree.
    stance: String,
    // String optional comment snapshot; no validation/default is specified.
    comment: String,
    // Date defaulted to now for activity ordering.
    votedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false })

const userSchema = new mongoose.Schema({
    // String, required and trimmed.
    name: {
        type: String,
        required: true,
        trim: true
    },
    // String, required, unique index, lowercased and trimmed.
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // String optional avatar URL; empty-string default.
    avatar: {
        type: String,
        default: ""
    },
    // String restricted to citizen; defaults to citizen. Admin role is assigned by separate Firebase authorization.
    role: {
        type: String,
        enum: ["citizen"],
        default: "citizen"
    },
    // Embedded voteSchema array; defaults to empty.
    votesCast: {
        type: [voteSchema],
        default: []
    },
    // Boolean account state; defaults to true.
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    // Adds managed createdAt/updatedAt fields; no explicit indexes beyond unique email.
    timestamps: true
})

module.exports = mongoose.models.User || mongoose.model("User", userSchema, "users")
