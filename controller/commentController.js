/**
 * @file commentController.js
 * @description Creates policy-comment handlers that validate citizen input and append comments to policy engagement data.
 * @module Controllers/PolicyComments
 * @requires mongoose and the Policy model
 */
const mongoose = require("mongoose")
const policyModel = require("../models/Policy")

/**
 * Builds the policy comment request handler.
 * @param {import("mongoose").Model} Policy Policy model.
 * @returns {import("express").RequestHandler} Handler for POST /policyComment.
 */
function createPolicyCommentController(Policy) {
    /**
     * @route POST /policyComment
     * @param {import("express").Request} req JSON {policyId, text}; authenticated uid in req.auth.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 201 {success, comment}; invalid input/identity/missing policy use 400/403/404.
     */
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
