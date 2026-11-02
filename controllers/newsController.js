/**
 * @file newsController.js
 * @description Implements news publishing, public feed serialization, citizen engagement, and admin deletion.
 * @module Controllers/News
 * @requires mongoose and News, User, and Policy models injected by the route module
 */
const mongoose = require("mongoose")

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 20_000
const MAX_COMMENT_LENGTH = 2_000

/**
 * Accepts credential-free HTTP(S) URLs for externally hosted news images.
 * @param {string} value Candidate URL.
 * @returns {boolean} Whether the image URL passes protocol and credential checks.
 */
function isValidImageUrl(value) {
    try {
        const url = new URL(value)
        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
    } catch {
        return false
    }
}

/**
 * Creates news handlers using injected models to support focused controller tests.
 * @param {object} dependencies Mongoose model dependencies.
 * @param {import("mongoose").Model} dependencies.News News model.
 * @param {import("mongoose").Model} dependencies.User User model.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @returns {{create: import("express").RequestHandler, list: import("express").RequestHandler, toggleLike: import("express").RequestHandler, addComment: import("express").RequestHandler, remove: import("express").RequestHandler}} News route handlers.
 */
function createNewsController({ News, User, Policy }) {
    /**
     * Publishes a validated news post and optional policy relation.
     * @route POST /api/news
     * @param {import("express").Request} req JSON body with title, content, imageUrl, and optional relatedPolicy.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 201 {success, news}, or a structured error response.
     */
    async function create(req, res) {
        // --- STEP 1: NORMALIZE AND VALIDATE USER-CONTROLLED CONTENT BEFORE MODEL CREATION ---
        const title = typeof req.body?.title === "string" ? req.body.title.trim() : ""
        const content = typeof req.body?.content === "string" ? req.body.content.trim() : ""
        const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : ""
        const relatedPolicyValue = typeof req.body?.relatedPolicy === "string"
            ? req.body.relatedPolicy.trim()
            : ""

        if (!title || title.length > MAX_TITLE_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `Title must be between 1 and ${MAX_TITLE_LENGTH} characters`
            })
        }
        if (!content || content.length > MAX_CONTENT_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `Content must be between 1 and ${MAX_CONTENT_LENGTH} characters`
            })
        }
        if (!isValidImageUrl(imageUrl)) {
            return res.status(400).json({ success: false, error: "A valid HTTP or HTTPS imageUrl is required" })
        }
        if (relatedPolicyValue && !mongoose.Types.ObjectId.isValid(relatedPolicyValue)) {
            return res.status(400).json({ success: false, error: "A valid relatedPolicy ID is required" })
        }

        // --- STEP 1: CHECK RELATED POLICY AND PERSIST THE NORMALIZED NEWS POST ---
        try {
            if (relatedPolicyValue && !(await Policy.exists({ _id: relatedPolicyValue }))) {
                return res.status(404).json({ success: false, error: "Related policy not found" })
            }

            const news = new News({
                title,
                content,
                imageUrl,
                ...(relatedPolicyValue ? { relatedPolicy: relatedPolicyValue } : {})
            })
            await news.save()
            return res.status(201).json({ success: true, news })
        } catch (error) {
            console.error("News publication failed:", error.stack || error)
            return res.status(500).json({ success: false, error: "Unable to publish news right now" })
        }
    }

    /**
     * Lists newest-first posts and strips raw liker IDs from the public response.
     * Guest visitors still receive the complete readable feed; authenticated visitors also receive their own like state.
     * @route GET /api/news
     * @param {import("express").Request} req Request with optional authenticated email.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 with an array of serialized news posts.
     */
    async function list(req, res) {
        try {
            // --- STEP 1: FETCH NEWEST POSTS AND POPULATE DISPLAY-ONLY REFERENCES ---
            let currentUserId = null
            if (req.auth?.email) {
                const user = await User.findOne({ email: req.auth.email })
                currentUserId = user?._id?.toString() || null
            }
            const posts = await News.find()
                .sort({ createdAt: -1 })
                .populate("comments.user", "name")
                .populate("relatedPolicy", "title")

            return res.status(200).json(posts.map(post => {
                const item = typeof post.toObject === "function" ? post.toObject() : { ...post }
                item.likesCount = Array.isArray(item.likes) ? item.likes.length : 0
                item.liked = Boolean(currentUserId
                    && Array.isArray(item.likes)
                    && item.likes.some(userId => userId.toString() === currentUserId))
                delete item.likes
                return item
            }))
        } catch (error) {
            console.error("News feed lookup failed:", error.stack || error)
            return res.status(500).json({ success: false, error: "Unable to load news right now" })
        }
    }

    /**
     * Resolves the authenticated citizen to a registered local user record.
     * @param {import("express").Request} req Authenticated request.
     * @param {import("express").Response} res Response used for missing-account errors.
     * @returns {Promise<object|null>} User document or null after responding.
     */
    async function getRegisteredUser(req, res) {
        if (!req.auth?.email) {
            res.status(403).json({ success: false, error: "A registered citizen account is required" })
            return null
        }

        const user = await User.findOne({ email: req.auth.email })
        if (!user) {
            res.status(404).json({ success: false, error: "Registered citizen not found" })
            return null
        }
        return user
    }

    /**
     * Toggles a registered citizen's like for a news post.
     * @route POST /api/news/:id/like
     * @param {import("express").Request} req News ObjectId in params and authenticated user in auth.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 {success, liked, likesCount}; errors use 400/403/404/500.
     */
    async function toggleLike(req, res) {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: "A valid news ID is required" })
        }

        // --- STEP 1: TOGGLE WITH ATOMIC ADD/REMOVE OPERATIONS TO AVOID DUPLICATE LIKES ---
        try {
            const user = await getRegisteredUser(req, res)
            if (!user) return

            const news = await News.findOneAndUpdate(
                { _id: req.params.id, likes: { $ne: user._id } },
                { $addToSet: { likes: user._id } },
                { new: true, runValidators: true }
            ).select("likes")

            if (news) {
                return res.status(200).json({
                    success: true,
                    liked: true,
                    likesCount: news.likes.length
                })
            }

            const unlikedNews = await News.findByIdAndUpdate(
                req.params.id,
                { $pull: { likes: user._id } },
                { new: true, runValidators: true }
            ).select("likes")
            if (!unlikedNews) {
                return res.status(404).json({ success: false, error: "News post not found" })
            }

            return res.status(200).json({
                success: true,
                liked: false,
                likesCount: unlikedNews.likes.length
            })
        } catch (error) {
            console.error("News like update failed:", error.stack || error)
            return res.status(500).json({ success: false, error: "Unable to update this like" })
        }
    }

    /**
     * Adds a validated comment to a news post for a registered citizen.
     * @route POST /api/news/:id/comment
     * @param {import("express").Request} req News ObjectId in params and JSON comment in body.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 201 {success, comment}; errors use 400/403/404/500.
     */
    async function addComment(req, res) {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: "A valid news ID is required" })
        }
        const commentText = typeof req.body?.comment === "string" ? req.body.comment.trim() : ""
        if (!commentText || commentText.length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `Comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`
            })
        }

        // --- STEP 1: RESOLVE THE REGISTERED AUTHOR, APPEND, AND RETURN THE STORED COMMENT ---
        try {
            const user = await getRegisteredUser(req, res)
            if (!user) return

            const comment = {
                _id: new mongoose.Types.ObjectId(),
                user: user._id,
                userName: user.name,
                comment: commentText,
                createdAt: new Date()
            }
            const news = await News.findByIdAndUpdate(
                req.params.id,
                {
                    $push: { comments: comment }
                },
                { new: true, runValidators: true }
            ).select("comments")

            if (!news) {
                return res.status(404).json({ success: false, error: "News post not found" })
            }

            return res.status(201).json({
                success: true,
                comment
            })
        } catch (error) {
            console.error("News comment creation failed:", error.stack || error)
            return res.status(500).json({ success: false, error: "Unable to add this comment" })
        }
    }

    /**
     * Deletes a news post; route-level middleware restricts this handler to administrators.
     * @route DELETE /api/news/:id
     * @param {import("express").Request} req News ObjectId in params.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 {success}; errors use 400/404/500.
     */
    async function remove(req, res) {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: "A valid news ID is required" })
        }

        try {
            const news = await News.findByIdAndDelete(req.params.id)
            if (!news) {
                return res.status(404).json({ success: false, error: "News post not found" })
            }
            return res.status(200).json({ success: true })
        } catch (error) {
            console.error("News deletion failed:", error.stack || error)
            return res.status(500).json({ success: false, error: "Unable to delete news right now" })
        }
    }

    return { create, list, toggleLike, addComment, remove }
}

module.exports = { createNewsController, isValidImageUrl }
