const test = require("node:test")
const assert = require("node:assert/strict")
const { createProfileActivityController } = require("../controller/userController")

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

function makeUserModel(user) {
    return {
        findOne: filter => {
            assert.deepEqual(filter, { email: "citizen@example.com" })
            return {
                select: fields => {
                    assert.equal(fields, "name createdAt votesCast")
                    return Promise.resolve(user)
                }
            }
        }
    }
}

test("profile activity returns actual vote history and handles an empty history", async () => {
    const policyId = "507f1f77bcf86cd799439011"
    const user = {
        name: "Test Citizen",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        votesCast: [
            { policyId, stance: "agree", votedAt: new Date("2026-02-01T00:00:00.000Z") }
        ]
    }
    const User = makeUserModel(user)
    const Policy = {
        find: filter => {
            assert.deepEqual(filter, { _id: { $in: [policyId] } })
            return {
                select: () => ({
                    lean: async () => [{
                        _id: policyId,
                        title: "Test policy",
                        category: "Health",
                        summary: "A saved policy"
                    }]
                })
            }
        }
    }
    const controller = createProfileActivityController({ User, Policy })
    const res = makeResponse()

    await controller({ auth: { email: "citizen@example.com" } }, res, error => { throw error })

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.profile.name, "Test Citizen")
    assert.equal(res.body.totalVotes, 1)
    assert.equal(res.body.activity[0].title, "Test policy")
    assert.equal(res.body.activity[0].stance, "agree")

    user.votesCast = []
    const emptyResponse = makeResponse()
    await controller({ auth: { email: "citizen@example.com" } }, emptyResponse, error => { throw error })
    assert.equal(emptyResponse.body.totalVotes, 0)
    assert.deepEqual(emptyResponse.body.activity, [])
})

test("profile activity returns not found when no profile exists", async () => {
    const controller = createProfileActivityController({
        User: makeUserModel(null),
        Policy: { find: async () => assert.fail("Policy query is not expected") }
    })
    const res = makeResponse()

    await controller({ auth: { email: "citizen@example.com" } }, res, error => { throw error })

    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.body, { error: "Citizen profile not found" })
})

test("profile activity requires authenticated account email", async () => {
    const controller = createProfileActivityController({
        User: { findOne: () => assert.fail("User query is not expected") },
        Policy: { find: () => assert.fail("Policy query is not expected") }
    })
    const res = makeResponse()

    await controller({}, res, error => { throw error })

    assert.equal(res.statusCode, 403)
})
