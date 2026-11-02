/**
 * @file newsRoutes.js
 * @description Defines the public news feed endpoints and role-protected news publishing, engagement, and deletion routes.
 * @module Routes/News
 * @requires express, internal news controller, authorization middleware, rate limiters, and Mongoose models
 */
const express = require("express")
const { createNewsController } = require("../controllers/newsController")
const { authorizeRoles } = require("../middleware/auth")
const { voteRateLimit, policyWriteRateLimit } = require("../controllers/rateLimitController")
const News = require("../models/News")
const User = require("../models/User")
const Policy = require("../models/Policy")

const router = express.Router()
const newsController = createNewsController({ News, User, Policy })
/**
 * Keeps news reads public while validating credentials when callers provide them.
 * @param {import("express").Request} req Request with an optional Authorization header.
 * @param {import("express").Response} res Express response.
 * @param {import("express").NextFunction} next Continues to the feed handler or authentication error handling.
 * @returns {void} Calls next middleware.
 * @throws {Error} For unexpected Firebase token verification failures.
 */
const optionalCitizenAuth = (req, res, next) => {
    if (!req.get("authorization")) return next()
    return authorizeRoles("citizen", "admin")(req, res, next)
}

/**
 * @route GET /api/news
 * @description Lists public news posts; a valid optional citizen token adds caller-specific like state.
 * @returns {200} Array of news post records; database failures return 500.
 */
// Public read access is intentional; authenticated visitors receive their own like state.
router.get("/", optionalCitizenAuth, newsController.list)
/**
 * @route POST /api/news
 * @description Publishes a news item.
 * @param {object} req.body News title, content, imageUrl, and optional relatedPolicy ID.
 * @returns {201} JSON {success, news}; errors use 400/401/403/404/500.
 */
router.post("/", policyWriteRateLimit, authorizeRoles("admin"), newsController.create)
/**
 * @route DELETE /api/news/:id
 * @description Deletes a news item; administrators only.
 * @param {string} req.params.id News ObjectId.
 * @returns {200} JSON {success}; errors use 400/401/403/404/500.
 */
router.delete("/:id", authorizeRoles("admin"), newsController.remove)
/**
 * @route POST /api/news/:id/like
 * @description Toggles the authenticated citizen's like.
 * @param {string} req.params.id News ObjectId.
 * @returns {200} JSON {success, liked, likesCount}; failures use 400/401/403/404/500.
 */
router.post("/:id/like", voteRateLimit, authorizeRoles("citizen"), newsController.toggleLike)
/**
 * @route POST /api/news/:id/comment
 * @description Adds a citizen comment.
 * @param {string} req.params.id News ObjectId.
 * @param {object} req.body Comment text (1-2000 characters).
 * @returns {201} JSON {success, comment}; failures use 400/401/403/404/500.
 */
router.post("/:id/comment", voteRateLimit, authorizeRoles("citizen"), newsController.addComment)

module.exports = router
