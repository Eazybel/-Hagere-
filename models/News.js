/**
 * @file News.js
 * @description Defines news posts, externally hosted image attribution, optional policy relations, likes, and embedded comments.
 * @module Models/News
 * @requires mongoose
 */
const mongoose = require("mongoose")

// Comment subdocuments receive their own ObjectId so clients can identify individual comments.
const commentSchema = new mongoose.Schema({
    // ObjectId ref to User; required comment author relation.
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // String, required and trimmed; author name is snapshotted for display.
    userName: {
        type: String,
        trim: true,
        required: true
    },
    // String, required, trimmed, maximum 2,000 characters.
    comment: {
        type: String,
        trim: true,
        required: true,
        maxlength: 2000
    },
    // Date defaulted to now.
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true })

const newsSchema = new mongoose.Schema({
    // String, required, trimmed, maximum 200 characters.
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    // String, required, trimmed, maximum 20,000 characters.
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20000
    },
    // String, required and trimmed; validates credential-free HTTP(S) URL. No field index.
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
    // String, optional, trimmed, empty-string default; source page for image attribution.
    imageSource: {
        type: String,
        trim: true,
        default: ""
    },
    // String, optional, trimmed, empty-string default; human-readable creator/license attribution.
    imageCredit: {
        type: String,
        trim: true,
        default: ""
    },
    // Nullable ObjectId ref to policyModel; stores the related policy when present.
    relatedPolicy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "policyModel",
        default: null
    },
    // Array of ObjectId refs to User documents; empty by default.
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    // Array of embedded commentSchema records; defaults to empty.
    comments: {
        type: [commentSchema],
        default: []
    },
    // String, trimmed; defaults to Government Communication Office.
    author: {
        type: String,
        default: "Government Communication Office",
        trim: true
    },
    // Date defaulted to now; also indexed descending below for newest-first feed retrieval.
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Supports the feed's newest-first createdAt sort.
newsSchema.index({ createdAt: -1 })

module.exports = mongoose.models.News || mongoose.model("News", newsSchema, "news")
