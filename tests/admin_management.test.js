const express = require("express")
const mongoose = require("mongoose")
const request = require("supertest")
const {
    createPolicyUpdateController,
    createPolicyDeleteController
} = require("../controllers/policyController")
const { createNewsController } = require("../controllers/newsController")

function makeAdminApp() {
    const policies = new Map()
    const newsPosts = new Map()

    class Policy {
        constructor(fields) {
            Object.assign(this, fields)
            this._id = new mongoose.Types.ObjectId()
            this.id = this._id.toString()
        }

        async save() {
            policies.set(this.id, this)
        }

        static async findById(id) {
            return policies.get(String(id)) || null
        }

        static async findByIdAndDelete(id) {
            const policy = policies.get(String(id)) || null
            if (policy) policies.delete(String(id))
            return policy
        }
    }

    class News {
        constructor(fields) {
            Object.assign(this, fields)
            this._id = new mongoose.Types.ObjectId()
            this.likes = []
            this.comments = []
        }

        async save() {
            newsPosts.set(this._id.toString(), this)
        }

        static async findByIdAndDelete(id) {
            const post = newsPosts.get(String(id)) || null
            if (post) newsPosts.delete(String(id))
            return post
        }

        static async updateMany(filter, update) {
            let modifiedCount = 0
            for (const post of newsPosts.values()) {
                if (post.relatedPolicy?.toString() === String(filter.relatedPolicy)) {
                    post.relatedPolicy = update.$set.relatedPolicy
                    modifiedCount++
                }
            }
            return { modifiedCount }
        }
    }

    const newsController = createNewsController({
        News,
        User: {},
        Policy
    })
    const app = express()
    app.use(express.json())
    const requireAdmin = (req, res, next) => {
        if (req.get("authorization") !== "Bearer test-admin") {
            return res.status(403).json({ success: false, error: "Admin access required" })
        }
        return next()
    }
    app.post("/api/policies", requireAdmin, createPolicyUpdateController({ Policy }))
    app.delete("/api/policies/:id", requireAdmin, createPolicyDeleteController({ Policy, News }))
    app.post("/api/news", requireAdmin, newsController.create)
    app.delete("/api/news/:id", requireAdmin, newsController.remove)

    return { app, policies, newsPosts }
}

describe("admin content management", () => {
    test("admin creates a policy with a document URL and deletion clears related news references", async () => {
        const { app, policies, newsPosts } = makeAdminApp()
        const documentUrl = "https://documents.example.test/policy.pdf"
        const created = await request(app)
            .post("/api/policies")
            .set("Authorization", "Bearer test-admin")
            .send({
                title: "Digital services",
                category: "Technology",
                description: "Policy summary",
                documentUrl
            })

        expect(created.status).toBe(201)
        const policyId = created.body.policyId
        expect(policies.get(policyId)).toMatchObject({
            category: "Technology",
            documentUrl
        })

        const relatedNewsId = new mongoose.Types.ObjectId().toString()
        newsPosts.set(relatedNewsId, {
            _id: new mongoose.Types.ObjectId(relatedNewsId),
            relatedPolicy: new mongoose.Types.ObjectId(policyId),
            comments: []
        })
        const deleted = await request(app)
            .delete(`/api/policies/${policyId}`)
            .set("Authorization", "Bearer test-admin")

        expect(deleted.status).toBe(200)
        expect(deleted.body).toEqual({ success: true })
        expect(policies.has(policyId)).toBe(false)
        expect(newsPosts.get(relatedNewsId).relatedPolicy).toBeNull()
    })

    test("admin deletes a news post and its embedded comments with the document", async () => {
        const { app, newsPosts } = makeAdminApp()
        const created = await request(app)
            .post("/api/news")
            .set("Authorization", "Bearer test-admin")
            .send({
                title: "Policy update",
                content: "News content",
                imageUrl: "https://images.example.test/policy.jpg"
            })

        expect(created.status).toBe(201)
        const newsId = created.body.news._id
        newsPosts.get(newsId).comments.push({ comment: "Stored with the post" })

        const deleted = await request(app)
            .delete(`/api/news/${newsId}`)
            .set("Authorization", "Bearer test-admin")

        expect(deleted.status).toBe(200)
        expect(deleted.body).toEqual({ success: true })
        expect(newsPosts.has(newsId)).toBe(false)
    })

    test("content deletion endpoints reject non-admin requests", async () => {
        const { app } = makeAdminApp()
        const response = await request(app).delete(`/api/news/${new mongoose.Types.ObjectId()}`)
        expect(response.status).toBe(403)
    })
})
