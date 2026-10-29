const test = require("node:test")
const assert = require("node:assert/strict")

process.env.NODE_ENV = "test"
process.env.PORT = "3000"
process.env.CONNECTION_STRING = "mongodb://127.0.0.1:27017/hagere-test"
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud"
process.env.CLOUDINARY_KEY = "test-key"
process.env.CLOUDINARY_SECRET = "test-secret"
process.env.FIREBASE_API = "test-api-key"
process.env.SERVICE_ACCOUNT = JSON.stringify({
    type: "service_account",
    project_id: "citizen-project",
    private_key: "test-key",
    client_email: "service@citizen-project.iam.gserviceaccount.com",
    client_id: "citizen-client"
})
process.env.ADMIN_FIREBASE_PROJECT_ID = "admin-project"
process.env.ADMIN_SERVICE_ACCOUNT = JSON.stringify({
    type: "service_account",
    project_id: "admin-project",
    private_key: "test-key",
    client_email: "service@admin-project.iam.gserviceaccount.com",
    client_id: "admin-client"
})
process.env.ADMIN_UIDS = "approved-admin"

const { createAuthorizeRoles } = require("../middleware/auth")

function makeToken(projectId) {
    const payload = Buffer.from(JSON.stringify({
        iss: `https://securetoken.google.com/${projectId}`
    })).toString("base64url")
    return `header.${payload}.signature`
}

function makeResponse() {
    return {
        statusCode: null,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode
            return this
        },
        json(body) {
            this.body = body
            return this
        }
    }
}

function makeMiddleware() {
    return createAuthorizeRoles({
        citizenProjectId: "citizen-project",
        adminProjectId: "admin-project",
        adminUids: ["approved-admin"],
        verifyCitizenToken: async () => ({
            uid: "citizen-1",
            email: "citizen@example.com",
            email_verified: true
        }),
        verifyAdminToken: async () => ({
            uid: "approved-admin",
            email: "admin@example.com"
        })
    })
}

test("citizen tokens cannot authorize admin routes", async () => {
    const authorizeRoles = makeMiddleware()
    const req = { get: () => `Bearer ${makeToken("citizen-project")}` }
    const res = makeResponse()
    let continued = false

    await authorizeRoles("admin")(req, res, () => { continued = true })

    assert.equal(res.statusCode, 403)
    assert.equal(continued, false)
})

test("an allowlisted admin token is accepted for admin routes", async () => {
    const authorizeRoles = makeMiddleware()
    const req = { get: () => `Bearer ${makeToken("admin-project")}` }
    const res = makeResponse()
    let continued = false

    await authorizeRoles("admin")(req, res, () => { continued = true })

    assert.equal(continued, true)
    assert.equal(req.auth.role, "admin")
    assert.equal(req.auth.uid, "approved-admin")
})

test("an admin-project account outside the UID allowlist is rejected", async () => {
    const authorizeRoles = createAuthorizeRoles({
        citizenProjectId: "citizen-project",
        adminProjectId: "admin-project",
        adminUids: ["approved-admin"],
        verifyCitizenToken: async () => assert.fail("Citizen verifier must not be used"),
        verifyAdminToken: async () => ({ uid: "unapproved-admin" })
    })
    const req = { get: () => `Bearer ${makeToken("admin-project")}` }
    const res = makeResponse()
    let continued = false

    await authorizeRoles("admin")(req, res, () => { continued = true })

    assert.equal(res.statusCode, 403)
    assert.match(res.body.error, /Firebase UID to ADMIN_UIDS/)
    assert.equal(continued, false)
})

test("requests without a bearer token are rejected", async () => {
    const authorizeRoles = makeMiddleware()
    const req = { get: () => undefined }
    const res = makeResponse()
    let continued = false

    await authorizeRoles("admin")(req, res, () => { continued = true })

    assert.equal(res.statusCode, 401)
    assert.equal(continued, false)
})

test("tokens from unknown Firebase projects are rejected", async () => {
    const authorizeRoles = makeMiddleware()
    const req = { get: () => `Bearer ${makeToken("unknown-project")}` }
    const res = makeResponse()
    let continued = false

    await authorizeRoles("admin")(req, res, () => { continued = true })

    assert.equal(res.statusCode, 401)
    assert.equal(continued, false)
})

test("unverified citizen accounts cannot use citizen routes", async () => {
    const authorizeRoles = createAuthorizeRoles({
        citizenProjectId: "citizen-project",
        adminProjectId: "admin-project",
        adminUids: ["approved-admin"],
        verifyCitizenToken: async () => ({
            uid: "citizen-1",
            email: "citizen@example.com",
            email_verified: false
        }),
        verifyAdminToken: async () => assert.fail("Admin verifier must not be used")
    })
    const req = { get: () => `Bearer ${makeToken("citizen-project")}` }
    const res = makeResponse()
    let continued = false

    await authorizeRoles("citizen")(req, res, () => { continued = true })

    assert.equal(res.statusCode, 403)
    assert.equal(continued, false)
})
