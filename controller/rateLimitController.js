const { rateLimit } = require("express-rate-limit")

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

const authRateLimit = createLimiter(10)
const voteRateLimit = createLimiter(20)
const policyWriteRateLimit = createLimiter(10)
const policyChatRateLimit = createLimiter(10)
const policyChatPollRateLimit = createLimiter(300)

module.exports = {
    authRateLimit,
    voteRateLimit,
    policyWriteRateLimit,
    policyChatRateLimit,
    policyChatPollRateLimit
}