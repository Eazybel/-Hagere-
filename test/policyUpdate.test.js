const test = require("node:test")
const assert = require("node:assert/strict")

process.env.NODE_ENV = "test"
process.env.PORT = "3000"
process.env.CONNECTION_STRING = "mongodb://127.0.0.1:27017/hagere-test"
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

const {
    createPolicyUpdateController,
    createPolicyListController,
    createPolicyFetchController
} = require("../controllers/policyController")

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

test("policy publishing stores a direct document URL and maps JSON fields to the schema", async () => {
    let policyData
    let saved = false
    class Policy {
        constructor(data) {
            policyData = data
            this.id = "policy-id"
        }
        async save() {
            saved = true
        }
    }
    const controller = createPolicyUpdateController({ Policy })
    const res = makeResponse()

    await controller({
        body: {
            title: "  Policy title  ",
            category: "  Economy  ",
            description: "  Summary  ",
            documentUrl: " https://documents.example/policy.pdf ",
            status: "active"
        }
    }, res)

    assert.deepEqual(policyData, {
        title: "Policy title",
        category: "Economy",
        summary: "Summary",
        documentUrl: "https://documents.example/policy.pdf",
        status: "active",
        totalVotes: 0,
        viewCount: 0,
        interactions: {
            votes: {
                agree: { count: 0, voters: [] },
                neutral: { count: 0, voters: [] },
                disagree: { count: 0, voters: [] }
            },
            comments: []
        }
    })
    assert.equal(saved, true)
    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, {
        policyId: "policy-id",
        documentUrl: "https://documents.example/policy.pdf"
    })
})

test("policy publishing accepts a direct HTTP document URL", async () => {
    let policyData
    class Policy {
        constructor(data) {
            policyData = data
        }
        async save() {}
    }

    const response = makeResponse()
    await createPolicyUpdateController({ Policy })({
        body: {
            title: "Public policy",
            category: "Governance",
            description: "A policy available over HTTP.",
            documentUrl: "http://documents.example/policy.pdf"
        }
    }, response)

    assert.equal(response.statusCode, 201)
    assert.equal(policyData.documentUrl, "http://documents.example/policy.pdf")
})

test("policy publishing rejects missing or invalid fields and reports database errors", async () => {
    const shouldNotSave = createPolicyUpdateController({
        Policy: { save: () => assert.fail("Invalid policy should not be saved") }
    })
    for (const body of [
        {},
        { title: "Title", category: "Economy", description: "Summary", documentUrl: "javascript:alert(1)" },
        { title: "Title", category: "Economy", description: "Summary", documentUrl: "ftp://documents.example/policy.pdf" }
    ]) {
        const response = makeResponse()
        await shouldNotSave({ body }, response)
        assert.equal(response.statusCode, 400)
        assert.equal(typeof response.body.error, "string")
    }

    class FailingPolicy {
        constructor() {
            this.id = "policy-id"
        }
        async save() {
            throw new Error("database unavailable")
        }
    }
    const saveFailureController = createPolicyUpdateController({ Policy: FailingPolicy })
    const saveFailureResponse = makeResponse()
    await saveFailureController({
        body: {
            title: "Title",
            category: "Economy",
            description: "Summary",
            documentUrl: "https://documents.example/policy.pdf"
        }
    }, saveFailureResponse)
    assert.equal(saveFailureResponse.statusCode, 500)
    assert.deepEqual(saveFailureResponse.body, { error: "Policy could not be saved" })
})

test("policy feed returns live database policies newest-first without caching", async () => {
    const policies = [
        { _id: "newest", title: "Newest", likes: ["citizen-id"], interactions: {} },
        { _id: "older", title: "Older", interactions: {} }
    ]
    let sortCriteria
    let cacheControl
    const controller = createPolicyListController({
        User: { findOne: async () => ({ _id: { toString: () => "citizen-id" } }) },
        Policy: {
            find: () => ({
                sort(criteria) {
                    sortCriteria = criteria
                    return Promise.resolve(policies)
                }
            })
        }
    })
    const res = makeResponse()
    res.set = (name, value) => {
        if (name === "Cache-Control") cacheControl = value
        return res
    }

    await controller({ auth: { email: "citizen@example.com" } }, res, error => { throw error })

    assert.deepEqual(sortCriteria, { createdAt: -1 })
    assert.equal(cacheControl, "no-store")
    assert.deepEqual(res.body.map(policy => policy._id), ["newest", "older"])
    assert.equal(res.body[0].likesCount, 1)
    assert.equal(res.body[0].liked, true)
    assert.equal(res.statusCode, 200)
})

test("policy detail reads increment and return the persisted view count", async () => {
    let updateArguments
    let cacheControl
    const policy = {
        _id: "policy-id",
        title: "Policy",
        category: "Economy",
        summary: "Summary",
        viewCount: 4,
        interactions: {
            votes: {
                agree: { count: 2, voters: [] },
                neutral: { count: 1, voters: [] },
                disagree: { count: 0, voters: [] }
            },
            comments: []
        }
    }
    const controller = createPolicyFetchController({
        Policy: {
            findByIdAndUpdate: async (...args) => {
                updateArguments = args
                return policy
            }
        },
        User: { findOne: async () => assert.fail("Anonymous views do not query users") }
    })
    const res = makeResponse()
    res.set = (name, value) => {
        if (name === "Cache-Control") cacheControl = value
        return res
    }

    await controller({ body: { requestType: "singlePolicyFetchNon", policyID: "policy-id" } }, res)

    assert.deepEqual(updateArguments, [
        "policy-id",
        { $inc: { viewCount: 1 } },
        { new: true }
    ])
    assert.equal(cacheControl, "no-store")
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.viewCount, 4)
})
