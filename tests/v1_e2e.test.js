jest.mock("../utils/env", () => ({
    SERVICE_ACCOUNT: { project_id: "citizen-project" },
    ADMIN_FIREBASE_PROJECT_ID: "admin-project",
    ADMIN_UIDS: ["test-admin"]
}))
jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn() }))
jest.mock("firebase-admin/app", () => ({ getApp: jest.fn() }))

const express = require("express")
const mongoose = require("mongoose")
const request = require("supertest")
const {
    createPolicyUpdateController,
    createPolicyDeleteController,
    createPolicyListController
} = require("../controllers/policyController")
const {
    createPolicyChatController,
    GEMINI_MODEL,
    GEMINI_RETRY_DELAY_MS
} = require("../controllers/policyChatController")
const { createNewsController } = require("../controllers/newsController")
const { createAuthorizeRoles } = require("../middleware/auth")

const CITIZEN_PROJECT_ID = "test-citizen-project"
const ADMIN_PROJECT_ID = "test-admin-project"
const POLICY_PDF_URL = "https://documents.example.test/policy.pdf"
const NEWS_IMAGE_URL = "https://images.example.test/policy-news.jpg"
const PDF_BYTES = Buffer.from("%PDF-1.7\nHagere test policy")

function makeFirebaseToken(projectId) {
    const payload = Buffer.from(JSON.stringify({
        iss: `https://securetoken.google.com/${projectId}`
    })).toString("base64url")
    return `test-header.${payload}.test-signature`
}

function makeQuery(items) {
    return {
        sort() {
            return this
        },
        populate() {
            return this
        },
        then(resolve, reject) {
            return Promise.resolve(items).then(resolve, reject)
        }
    }
}

function makeTestApp({ fetchImpl, sleep, chatTimeoutMs } = {}) {
    const state = {
        policies: new Map(),
        news: new Map(),
        users: new Map(),
        databaseFailure: null
    }

    const citizen = {
        _id: new mongoose.Types.ObjectId(),
        uid: "test-citizen",
        name: "Test Citizen",
        email: "citizen@example.test"
    }
    const admin = {
        _id: new mongoose.Types.ObjectId(),
        uid: "test-admin",
        name: "Test Admin",
        email: "admin@example.test"
    }
    state.users.set(citizen.email, citizen)
    state.users.set(admin.email, admin)

    class Policy {
        constructor(fields) {
            Object.assign(this, fields)
            this._id = new mongoose.Types.ObjectId()
            this.id = this._id.toString()
            this.createdAt = new Date()
        }

        async save() {
            state.policies.set(this.id, this)
        }

        toObject() {
            return { ...this }
        }

        static find() {
            return makeQuery([...state.policies.values()])
        }

        static findById(id) {
            return {
                async select() {
                    if (state.databaseFailure) {
                        await new Promise(resolve => setTimeout(resolve, state.databaseFailure.delayMs))
                        throw state.databaseFailure.error
                    }
                    return state.policies.get(String(id)) || null
                },
                then(resolve, reject) {
                    return this.select().then(resolve, reject)
                }
            }
        }

        static async findByIdAndDelete(id) {
            const policy = state.policies.get(String(id)) || null
            if (policy) state.policies.delete(String(id))
            return policy
        }

        static async exists({ _id }) {
            return state.policies.has(String(_id))
        }
    }

    class News {
        constructor(fields) {
            Object.assign(this, fields)
            this._id = new mongoose.Types.ObjectId()
            this.likes = []
            this.comments = []
            this.createdAt = new Date()
        }

        async save() {
            state.news.set(this._id.toString(), this)
        }

        toObject() {
            return { ...this }
        }

        static find() {
            return makeQuery([...state.news.values()])
        }

        static findOneAndUpdate(filter, update) {
            const post = state.news.get(String(filter._id))
            const userId = update.$addToSet?.likes
            const result = post && userId
                && !post.likes.some(like => like.toString() === userId.toString())
                ? (post.likes.push(userId), post)
                : null
            return { select: async () => result ? { likes: result.likes } : null }
        }

        static findByIdAndUpdate(id, update) {
            const post = state.news.get(String(id))
            if (!post) return { select: async () => null }

            if (update.$pull?.likes) {
                const userId = update.$pull.likes.toString()
                post.likes = post.likes.filter(like => like.toString() !== userId)
            }
            if (update.$push?.comments) post.comments.push(update.$push.comments)

            return {
                select: async () => update.$push
                    ? { comments: post.comments }
                    : { likes: post.likes }
            }
        }

        static async findByIdAndDelete(id) {
            const post = state.news.get(String(id)) || null
            if (post) state.news.delete(String(id))
            return post
        }

        static async updateMany(filter, update) {
            let modifiedCount = 0
            for (const post of state.news.values()) {
                if (post.relatedPolicy?.toString() === String(filter.relatedPolicy)) {
                    post.relatedPolicy = update.$set.relatedPolicy
                    modifiedCount++
                }
            }
            return { modifiedCount }
        }
    }

    const User = {
        async findOne({ email }) {
            return state.users.get(email) || null
        }
    }

    const authorizeRoles = createAuthorizeRoles({
        citizenProjectId: CITIZEN_PROJECT_ID,
        adminProjectId: ADMIN_PROJECT_ID,
        adminUids: [admin.uid],
        verifyCitizenToken: async () => ({
            uid: citizen.uid,
            email: citizen.email,
            email_verified: true
        }),
        verifyAdminToken: async () => ({
            uid: admin.uid,
            email: admin.email
        })
    })

    const app = express()
    app.use(express.json())

    app.post("/api/policies", authorizeRoles("admin"), createPolicyUpdateController({ Policy }))
    app.delete("/api/policies/:id", authorizeRoles("admin"), createPolicyDeleteController({ Policy, News }))
    app.get(
        "/api/policies",
        (req, res, next) => req.get("authorization")
            ? authorizeRoles("citizen", "admin")(req, res, next)
            : next(),
        createPolicyListController({ Policy, User })
    )

    const chatController = createPolicyChatController({
        Policy,
        apiKey: "test-gemini-api-key",
        fetchImpl,
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        sleep,
        timeoutMs: chatTimeoutMs
    })
    app.post("/api/policies/:id/chat", chatController.create)

    const newsController = createNewsController({ News, User, Policy })
    app.get("/api/news", (req, res, next) => req.get("authorization")
        ? authorizeRoles("citizen")(req, res, next)
        : next(), newsController.list)
    app.post("/api/news", authorizeRoles("admin"), newsController.create)
    app.delete("/api/news/:id", authorizeRoles("admin"), newsController.remove)
    app.post("/api/news/:id/like", authorizeRoles("citizen"), newsController.toggleLike)
    app.post("/api/news/:id/comment", authorizeRoles("citizen"), newsController.addComment)

    return {
        app,
        state,
        citizen,
        citizenToken: makeFirebaseToken(CITIZEN_PROJECT_ID),
        adminToken: makeFirebaseToken(ADMIN_PROJECT_ID)
    }
}

function makePdfAndGeminiFetch({ geminiResponses, onGeminiRequest } = {}) {
    const requests = []
    let responseIndex = 0

    const fetchImpl = async (url, options = {}) => {
        requests.push({ url, options })
        if (url instanceof URL) return new Response(PDF_BYTES, {
            headers: { "content-type": "application/pdf" }
        })

        if (onGeminiRequest) onGeminiRequest(options)
        if (geminiResponses?.length) return geminiResponses[responseIndex++]
            || Response.json({
                candidates: [{ content: { parts: [{ text: "የፖሊሲው መልስ።" }] } }]
            })

        return Response.json({
            candidates: [{ content: { parts: [{ text: "የፖሊሲው መልስ።" }] } }]
        })
    }

    return { fetchImpl, requests }
}

describe("Hagere v1 HTTP integration flows", () => {
    let consoleError

    beforeEach(() => {
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        consoleError.mockRestore()
    })

    test("admin Firebase ID-token fixture is authorized and a citizen is denied policy writes", async () => {
        const { app, citizenToken, adminToken, state } = makeTestApp()

        const denied = await request(app)
            .post("/api/policies")
            .set("Authorization", `Bearer ${citizenToken}`)
            .send({
                title: "Test policy",
                category: "Public services",
                description: "A test summary",
                documentUrl: POLICY_PDF_URL
            })

        expect(denied.status).toBe(403)
        expect(state.policies.size).toBe(0)

        const created = await request(app)
            .post("/api/policies")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Test policy",
                category: "Public services",
                description: "A test summary",
                documentUrl: POLICY_PDF_URL,
                status: "Active"
            })

        expect(created.status).toBe(201)
        expect(state.policies.size).toBe(1)
    })

    test("admin publishes a document URL and policy feed exposes it", async () => {
        const { app, state, adminToken } = makeTestApp()

        const created = await request(app)
            .post("/api/policies")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Digital Services Policy",
                category: "Technology",
                description: "A policy document for integration testing.",
                documentUrl: POLICY_PDF_URL,
                status: "Active"
            })

        expect(created.status).toBe(201)
        expect(state.policies.get(created.body.policyId).documentUrl).toBe(POLICY_PDF_URL)

        const feed = await request(app).get("/api/policies")
        expect(feed.status).toBe(200)
        expect(feed.body).toEqual([expect.objectContaining({
            title: "Digital Services Policy",
            documentUrl: POLICY_PDF_URL,
            pdfUrl: POLICY_PDF_URL
        })])
    })

    test("guests can read public catalogs while protected deletion and engagement routes reject unauthenticated requests", async () => {
        const { app, state, adminToken } = makeTestApp()
        const policy = await request(app)
            .post("/api/policies")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Guest-readable policy",
                category: "Public services",
                description: "Public policy summary.",
                documentUrl: POLICY_PDF_URL
            })
        const news = await request(app)
            .post("/api/news")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Guest-readable news",
                content: "Public news content.",
                imageUrl: NEWS_IMAGE_URL
            })

        expect(policy.status).toBe(201)
        expect(news.status).toBe(201)

        const [policyFeed, newsFeed] = await Promise.all([
            request(app).get("/api/policies"),
            request(app).get("/api/news")
        ])
        expect(policyFeed.status).toBe(200)
        expect(policyFeed.body[0].title).toBe("Guest-readable policy")
        expect(newsFeed.status).toBe(200)
        expect(newsFeed.body[0].title).toBe("Guest-readable news")

        const policyId = policy.body.policyId
        const newsId = news.body.news._id
        const responses = await Promise.all([
            request(app).delete(`/api/policies/${policyId}`),
            request(app).delete(`/api/news/${newsId}`),
            request(app).post(`/api/news/${newsId}/like`).send({}),
            request(app).post(`/api/news/${newsId}/comment`).send({ comment: "Guest comment" })
        ])
        expect(responses.map(response => response.status)).toEqual([401, 401, 401, 401])
        expect(state.policies.has(policyId)).toBe(true)
        expect(state.news.has(newsId)).toBe(true)
    })

    test("policy chat downloads and encodes the PDF, sends an abort signal, and returns Amharic", async () => {
        let geminiOptions
        const { fetchImpl, requests } = makePdfAndGeminiFetch({
            onGeminiRequest: options => { geminiOptions = options }
        })
        const testApp = makeTestApp({ fetchImpl })
        const policyId = new mongoose.Types.ObjectId().toString()
        testApp.state.policies.set(policyId, { pdfUrl: POLICY_PDF_URL })

        const response = await request(testApp.app)
            .post(`/api/policies/${policyId}/chat`)
            .send({ message: "What does this policy require?" })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ success: true, reply: "የፖሊሲው መልስ።" })
        expect(requests[0].url.href).toBe(POLICY_PDF_URL)
        expect(requests[0].options.signal).toBeInstanceOf(AbortSignal)
        expect(geminiOptions.signal).toBeInstanceOf(AbortSignal)
        expect(geminiOptions.headers["x-goog-api-key"]).toBe("test-gemini-api-key")

        const geminiPayload = JSON.parse(geminiOptions.body)
        expect(geminiPayload.contents[0].parts[0]).toEqual({
            inline_data: {
                mime_type: "application/pdf",
                data: PDF_BYTES.toString("base64")
            }
        })
        expect(geminiPayload.contents[0].parts[1].text).toBe("What does this policy require?")
        expect(GEMINI_MODEL).toBe("gemini-3.1-flash-lite")
    })

    test("citizen can like and comment on admin news, and feed reflects both changes", async () => {
        const { app, citizenToken, adminToken } = makeTestApp()
        const created = await request(app)
            .post("/api/news")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Policy announcement",
                content: "A test news post.",
                imageUrl: NEWS_IMAGE_URL
            })

        expect(created.status).toBe(201)
        expect(created.body.news.imageUrl).toBe(NEWS_IMAGE_URL)
        const newsId = created.body.news._id

        const like = await request(app)
            .post(`/api/news/${newsId}/like`)
            .set("Authorization", `Bearer ${citizenToken}`)
        expect(like.status).toBe(200)
        expect(like.body).toMatchObject({ success: true, liked: true, likesCount: 1 })

        const comment = await request(app)
            .post(`/api/news/${newsId}/comment`)
            .set("Authorization", `Bearer ${citizenToken}`)
            .send({ comment: "Thank you for the update." })
        expect(comment.status).toBe(201)
        expect(comment.body.comment.comment).toBe("Thank you for the update.")

        const feed = await request(app)
            .get("/api/news")
            .set("Authorization", `Bearer ${citizenToken}`)
        expect(feed.status).toBe(200)
        expect(feed.body[0]).toMatchObject({
            imageUrl: NEWS_IMAGE_URL,
            likesCount: 1,
            liked: true
        })
        expect(feed.body[0].comments).toEqual([
            expect.objectContaining({ comment: "Thank you for the update." })
        ])
    })

    test("Gemini 503 responses trigger retry backoff and eventually succeed", async () => {
        const delays = []
        const { fetchImpl } = makePdfAndGeminiFetch({
            geminiResponses: [
                Response.json({ error: { message: "busy" } }, { status: 503 }),
                Response.json({ error: { message: "still busy" } }, { status: 503 }),
                Response.json({
                    candidates: [{ content: { parts: [{ text: "የፖሊሲው መልስ።" }] } }]
                })
            ]
        })
        const isolated = makeTestApp({ fetchImpl, sleep: async ms => delays.push(ms) })
        const isolatedPolicy = new mongoose.Types.ObjectId().toString()
        isolated.state.policies.set(isolatedPolicy, { pdfUrl: POLICY_PDF_URL })

        const response = await request(isolated.app)
            .post(`/api/policies/${isolatedPolicy}/chat`)
            .send({ message: "Explain the policy." })

        expect(response.status).toBe(200)
        expect(response.body.reply).toBe("የፖሊሲው መልስ።")
        expect(delays).toEqual([GEMINI_RETRY_DELAY_MS, GEMINI_RETRY_DELAY_MS])
    })

    test("Gemini timeout is aborted and database selection failures return a controlled response", async () => {
        const pendingFetch = async (url, options = {}) => {
            if (url instanceof URL) return new Response(PDF_BYTES)
            return new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })
            })
        }
        const timedOut = makeTestApp({ fetchImpl: pendingFetch, chatTimeoutMs: 5 })
        const timedOutPolicy = new mongoose.Types.ObjectId().toString()
        timedOut.state.policies.set(timedOutPolicy, { pdfUrl: POLICY_PDF_URL })

        const timeoutResponse = await request(timedOut.app)
            .post(`/api/policies/${timedOutPolicy}/chat`)
            .send({ message: "Explain the policy." })
        expect(timeoutResponse.status).toBe(504)
        expect(timeoutResponse.body.success).toBe(false)

        const dbFailureApp = makeTestApp()
        const dbFailurePolicy = new mongoose.Types.ObjectId().toString()
        dbFailureApp.state.policies.set(dbFailurePolicy, { pdfUrl: POLICY_PDF_URL })
        dbFailureApp.state.databaseFailure = {
            delayMs: 10,
            error: Object.assign(new Error("server selection timed out"), {
                name: "MongooseServerSelectionError"
            })
        }

        const dbResponse = await request(dbFailureApp.app)
            .post(`/api/policies/${dbFailurePolicy}/chat`)
            .send({ message: "Explain the policy." })
        expect(dbResponse.status).toBe(500)
        expect(dbResponse.body).toEqual({
            success: false,
            error: "Unable to load this policy"
        })
    })
})
