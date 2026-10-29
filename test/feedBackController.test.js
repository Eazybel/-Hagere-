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

const { createFeedBackController } = require("../controller/feedBackController")

const policyId = "507f1f77bcf86cd799439011"

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

test("vote endpoint updates policy tallies and logs the citizen stance", async () => {
    const user = { id: "citizen-id", _id: "citizen-db-id" }
    let updateFilter
    let updateData
    let userVoteLog
    const controller = createFeedBackController({
        User: {
            findOne: async filter => {
                assert.deepEqual(filter, { email: "citizen@example.com" })
                return user
            },
            updateOne: async (...args) => { userVoteLog = args }
        },
        Policy: {
            findOneAndUpdate: async (...args) => {
                ;[updateFilter, updateData] = args
                return { _id: policyId, totalVotes: 3 }
            }
        }
    })
    const res = makeResponse()

    await controller({
        body: { policyId, requestType: "agree" },
        auth: { email: "citizen@example.com" }
    }, res)

    assert.deepEqual(updateFilter, {
        _id: policyId,
        $and: [
            { "interactions.votes.agree.voters": { $ne: "citizen-id" } },
            { "interactions.votes.neutral.voters": { $ne: "citizen-id" } },
            { "interactions.votes.disagree.voters": { $ne: "citizen-id" } }
        ]
    })
    assert.deepEqual(updateData, {
        $inc: { totalVotes: 1, "interactions.votes.agree.count": 1 },
        $addToSet: { "interactions.votes.agree.voters": "citizen-id" }
    })
    assert.deepEqual(userVoteLog, [
        { _id: "citizen-db-id" },
        { $push: { votesCast: { policyId, stance: "agree" } } }
    ])
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { success: true, totalVotes: 3 })
})

test("vote endpoint returns JSON errors for invalid input and duplicate votes", async () => {
    let lookupCalled = false
    const controller = createFeedBackController({
        User: {
            findOne: async () => {
                lookupCalled = true
                return { id: "citizen-id", _id: "citizen-db-id" }
            },
            updateOne: async () => assert.fail("A duplicate must not be logged")
        },
        Policy: {
            findOneAndUpdate: async () => null,
            exists: async () => true
        }
    })
    const invalidResponse = makeResponse()
    await controller({
        body: { policyId: "invalid-id", requestType: "agree" },
        auth: { email: "citizen@example.com" }
    }, invalidResponse)
    assert.equal(invalidResponse.statusCode, 400)
    assert.equal(typeof invalidResponse.body.error, "string")
    assert.equal(lookupCalled, false)

    const duplicateResponse = makeResponse()
    await controller({
        body: { policyId, requestType: "neutral" },
        auth: { email: "citizen@example.com" }
    }, duplicateResponse)
    assert.equal(duplicateResponse.statusCode, 409)
    assert.deepEqual(duplicateResponse.body, {
        error: "A vote has already been recorded for this policy"
    })
})
