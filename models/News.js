const mongoose = require("mongoose")

const commentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userName: {
        type: String,
        trim: true,
        required: true
    },
    comment: {
        type: String,
        trim: true,
        required: true,
        maxlength: 2000
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true })

const newsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20000
    },
    imageUrl: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator(value) {
                try {
                    const url = new URL(value)
                    return ["http:", "https:"].includes(url.protocol)
                        && !url.username
                        && !url.password
                } catch {
                    return false
                }
            },
            message: "Image URL must be a valid HTTP or HTTPS URL"
        }
    },
    relatedPolicy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "policyModel",
        default: null
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    comments: {
        type: [commentSchema],
        default: []
    },
    author: {
        type: String,
        default: "Government Communication Office",
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

newsSchema.index({ createdAt: -1 })

module.exports = mongoose.models.News || mongoose.model("News", newsSchema, "news")
