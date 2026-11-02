/**
 * @file policyLikeController.js
 * @description Creates the policy like toggle handler for registered citizens.
 * @module Controllers/PolicyLikes
 * @requires mongoose and injected Policy and User models
 */
const mongoose = require("mongoose")

/**
 * Builds the policy like toggle handler.
 * @param {object} dependencies Mongoose model dependencies.
 * @param {import("mongoose").Model} dependencies.Policy Policy model.
 * @param {import("mongoose").Model} dependencies.User User model.
 * @returns {import("express").RequestHandler} Handler for POST /api/policies/:id/like.
 */
function createPolicyLikeController({ Policy, User }) {
    /**
     * @route POST /api/policies/:id/like
     * @param {import("express").Request} req Policy ObjectId in params and verified account email in auth.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 {success, liked, likesCount}; failures use 400/403/404/500.
     */
    return async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: "A valid policy ID is required" })
        }
        if (!req.auth?.email) {
            return res.status(403).json({ success: false, error: "Verified account email required" })
        }

        try {
            const user = await User.findOne({ email: req.auth.email })
            if (!user) return res.status(404).json({ success: false, error: "Registered citizen not found" })

            const likedPolicy = await Policy.findOneAndUpdate(
                { _id: req.params.id, likes: { $ne: user._id } },
                { $addToSet: { likes: user._id } },
                { new: true, runValidators: true }
            ).select("likes")

            if (likedPolicy) {
                return res.status(200).json({
                    success: true,
                    liked: true,
                    likesCount: likedPolicy.likes.length
                })
            }

            const unlikedPolicy = await Policy.findByIdAndUpdate(
                req.params.id,
                { $pull: { likes: user._id } },
                { new: true, runValidators: true }
            ).select("likes")
            if (!unlikedPolicy) {
                return res.status(404).json({ success: false, error: "Policy not found" })
            }
            return res.status(200).json({
                success: true,
                liked: false,
                likesCount: unlikedPolicy.likes.length
            })
        } catch (error) {
            console.error("Policy like update failed:", error.stack || error)
            return res.status(500).json({ success: false, error: "Unable to update this like" })
        }
    }
}

module.exports = { createPolicyLikeController }
