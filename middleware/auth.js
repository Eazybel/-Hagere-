const { getAuth } = require("firebase-admin/auth")
const { getApp } = require("firebase-admin/app")
const env = require("../utils/env")

const validRoles = new Set(["citizen", "admin"])
const invalidTokenErrorCodes = new Set([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/user-disabled",
    "auth/user-not-found"
])

function getBearerToken(req) {
    const authorization = req.get("authorization")
    const match = typeof authorization === "string" && authorization.match(/^Bearer\s+(.+)$/i)
    return match ? match[1].trim() : null
}

function getTokenProjectId(token) {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
        const prefix = "https://securetoken.google.com/"
        // The untrusted issuer only selects the verifier; Firebase verifies the token below.
        return typeof payload.iss === "string" && payload.iss.startsWith(prefix)
            ? payload.iss.slice(prefix.length)
            : null
    } catch {
        return null
    }
}

function createAuthorizeRoles({
    citizenProjectId,
    adminProjectId,
    adminUids,
    verifyCitizenToken,
    verifyAdminToken
}) {
    return (...allowedRoles) => {
        if (!allowedRoles.length || allowedRoles.some(role => !validRoles.has(role))) {
            throw new TypeError("authorizeRoles requires one or more valid roles")
        }

        return async (req, res, next) => {
            const token = getBearerToken(req)
            if (!token) {
                return res.status(401).json({ error: "Authentication required" })
            }

            const projectId = getTokenProjectId(token)
            let role
            let decodedToken

            try {
                if (projectId === adminProjectId) {
                    decodedToken = await verifyAdminToken(token)
                    if (!adminUids.includes(decodedToken.uid)) {
                        return res.status(403).json({
                            error: "This account is not authorized as an administrator. Add its Firebase UID to ADMIN_UIDS and restart the server."
                        })
                    }
                    role = "admin"
                } else if (projectId === citizenProjectId) {
                    decodedToken = await verifyCitizenToken(token)
                    role = "citizen"
                } else {
                    return res.status(401).json({ error: "Invalid authentication token" })
                }
            } catch (error) {
                if (invalidTokenErrorCodes.has(error.code)) {
                    return res.status(401).json({ error: "Invalid or expired authentication token" })
                }
                return next(error)
            }

            if (!allowedRoles.includes(role)) {
                return res.status(403).json({ error: "Insufficient permissions" })
            }
            if (role === "citizen" && decodedToken.email_verified !== true) {
                return res.status(403).json({ error: "Verified citizen account required" })
            }

            req.auth = {
                uid: decodedToken.uid,
                email: decodedToken.email || null,
                role
            }
            return next()
        }
    }
}

const authorizeRoles = createAuthorizeRoles({
    citizenProjectId: env.SERVICE_ACCOUNT.project_id,
    adminProjectId: env.ADMIN_FIREBASE_PROJECT_ID,
    adminUids: env.ADMIN_UIDS,
    verifyCitizenToken: token => getAuth().verifyIdToken(token, true),
    verifyAdminToken: token => getAuth(getApp("admin-auth")).verifyIdToken(token, true)
})

module.exports = { authorizeRoles, createAuthorizeRoles }
