const express = require("express")
const { createNewsController } = require("../controllers/newsController")
const { authorizeRoles } = require("../middleware/auth")
const { voteRateLimit, policyWriteRateLimit } = require("../controller/rateLimitController")
const News = require("../models/News")
const User = require("../models/User")
const Policy = require("../models/Policy")

const router = express.Router()
const newsController = createNewsController({ News, User, Policy })
const optionalCitizenAuth = (req, res, next) => {
    if (!req.get("authorization")) return next()
    return authorizeRoles("citizen")(req, res, next)
}

router.get("/", optionalCitizenAuth, newsController.list)
router.post("/", policyWriteRateLimit, authorizeRoles("admin"), newsController.create)
router.post("/:id/like", voteRateLimit, authorizeRoles("citizen"), newsController.toggleLike)
router.post("/:id/comment", voteRateLimit, authorizeRoles("citizen"), newsController.addComment)

module.exports = router
