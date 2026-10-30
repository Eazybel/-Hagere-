const mongoose = require("mongoose")

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 20_000
const MAX_COMMENT_LENGTH = 2_000

function isValidImageUrl(value) {
    try {
        const url = new URL(value)
        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
    } catch {
        return false
    }
}

function createNewsController({ News, User, Policy }) {
    async function create(req, res) {
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

    async function list(req, res) {
        try {
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

    async function toggleLike(req, res) {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: "A valid news ID is required" })
        }

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

    return { create, list, toggleLike, addComment }
}

module.exports = { createNewsController, isValidImageUrl }
