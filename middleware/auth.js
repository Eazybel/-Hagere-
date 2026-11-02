/**
 * @file auth.js
 * @description Extracts Firebase Bearer tokens, validates their project and role, and attaches verified identity to requests.
 * @module Middleware/Authorization
 * @requires firebase-admin, internal environment configuration
 */
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

/**
 * Extracts a Bearer token without accepting alternate authorization schemes.
 * @param {import("express").Request} req Incoming request.
 * @returns {?string} Trimmed token or null when absent/invalid.
 */
function getBearerToken(req) {
    const authorization = req.get("authorization")
    const match = typeof authorization === "string" && authorization.match(/^Bearer\s+(.+)$/i)
    return match ? match[1].trim() : null
}

/**
 * Reads an issuer project ID only to select the Firebase verifier; it does not authenticate the token.
 * @param {string} token Unverified compact JWT.
 * @returns {?string} Firebase project ID from the issuer, or null if malformed.
 */
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

/**
 * Creates role-based Firebase authorization middleware.
 * @param {object} options Verifier functions and configured Firebase project/UID allowlists.
 * @returns {(...roles: string[]) => import("express").RequestHandler} Middleware factory.
 * @throws {TypeError} If no valid roles are supplied to the returned factory.
 */
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

        /**
         * Verifies the credential with a trusted Firebase project before assigning a role.
         * @param {import("express").Request} req Request to authenticate.
         * @param {import("express").Response} res Express response.
         * @param {import("express").NextFunction} next Continues on success or forwards unexpected verification errors.
         * @returns {Promise<void>} Responds with 401/403 or calls next.
         */
        return async (req, res, next) => {
            // --- STEP 1: EXTRACT THE BEARER TOKEN AND SELECT A VERIFIER FROM ITS UNTRUSTED ISSUER ---
            const token = getBearerToken(req)
            if (!token) {
                return res.status(401).json({ error: "Authentication required" })
            }

            const projectId = getTokenProjectId(token)
            let role
            let decodedToken

            try {
                // --- STEP 2: VERIFY SIGNATURE, PROJECT, AND ADMIN UID ALLOWLIST ---
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

            // --- STEP 3: ENFORCE ROUTE ROLE AND CITIZEN EMAIL-VERIFICATION REQUIREMENTS ---
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

/** Production role middleware bound to the configured citizen and admin Firebase projects. */
module.exports = { authorizeRoles, createAuthorizeRoles }
