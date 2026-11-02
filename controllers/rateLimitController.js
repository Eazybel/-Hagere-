/**
 * @file rateLimitController.js
 * @description Defines shared request-rate limits for authentication, votes, writes, and policy chat operations.
 * @module Controllers/RateLimits
 * @requires express-rate-limit
 */
const { rateLimit } = require("express-rate-limit")

/**
 * Creates a JSON-returning limiter using a shared 15-minute window.
 * @param {number} limit Maximum requests allowed in the configured window.
 * @returns {import("express").RequestHandler} Express rate-limiting middleware; excess calls receive HTTP 429.
 */
const createLimiter = limit => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later."
    })
})

/** Shared limiter: authentication requests. */
const authRateLimit = createLimiter(10)
/** Shared limiter: citizen vote and engagement requests. */
const voteRateLimit = createLimiter(20)
/** Shared limiter: admin content writes. */
const policyWriteRateLimit = createLimiter(10)
/** Shared limiter: initial policy chat submissions. */
const policyChatRateLimit = createLimiter(10)
/** Shared limiter: polling asynchronous chat status. */
const policyChatPollRateLimit = createLimiter(300)

module.exports = {
    authRateLimit,
    voteRateLimit,
    policyWriteRateLimit,
    policyChatRateLimit,
    policyChatPollRateLimit
}