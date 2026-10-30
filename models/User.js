const mongoose = require("mongoose")

const voteSchema = new mongoose.Schema({
    policyId: String,
    stance: String,
    comment: String,
    votedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false })

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    avatar: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["citizen"],
        default: "citizen"
    },
    votesCast: {
        type: [voteSchema],
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
})

module.exports = mongoose.models.User || mongoose.model("User", userSchema, "users")
