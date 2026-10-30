const mongoose = require("mongoose")
const policyModel = require("../models/Policy")

function createPolicyCommentController(Policy) {
    return async (req, res) => {
        const { policyId, text } = req.body || {}
        const normalizedText = typeof text === "string" ? text.trim() : ""

        if (!mongoose.Types.ObjectId.isValid(policyId)) {
            return res.status(400).json({ error: "A valid policy ID is required" })
        }
        if (!normalizedText || normalizedText.length > 2000) {
            return res.status(400).json({ error: "Comment must be between 1 and 2000 characters" })
        }
        if (!req.auth?.uid) {
            return res.status(403).json({ error: "Authenticated citizen required" })
        }

        const policy = await Policy.findByIdAndUpdate(
            policyId,
            {
                $push: {
                    "interactions.comments": {
                        user: req.auth.uid,
                        text: normalizedText
                    }
                }
            },
            { new: true, runValidators: true }
        ).select("interactions.comments")

        if (!policy) {
            return res.status(404).json({ error: "Policy not found" })
        }

        const storedComment = policy.interactions.comments.at(-1)
        return res.status(201).json({
            success: true,
            comment: {
                text: storedComment.text,
                createdAt: storedComment.createdAt
            }
        })
    }
}

module.exports = createPolicyCommentController(policyModel)
module.exports.createPolicyCommentController = createPolicyCommentController
