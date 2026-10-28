const test = require("node:test")
const assert = require("node:assert/strict")
const { createPolicyCommentController } = require("../controller/commentController")

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

test("comment controller stores authenticated citizen comments in MongoDB", async () => {
    const comment = { text: "A useful comment", createdAt: new Date("2026-01-01T00:00:00Z") }
    const res = makeResponse()
    let updateArguments
    const controller = createPolicyCommentController({
        findByIdAndUpdate: (...args) => {
            updateArguments = args
            return { select: async () => ({ interactions: { comments: [comment] } }) }
        }
    })

    await controller({
        body: { policyId, text: "  A useful comment  " },
        auth: { uid: "citizen-uid" }
    }, res)

    assert.equal(updateArguments[0], policyId)
    assert.deepEqual(updateArguments[1], {
        $push: {
            "interactions.comments": {
                user: "citizen-uid",
                text: "A useful comment"
            }
        }
    })
    assert.deepEqual(updateArguments[2], { new: true, runValidators: true })
    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, { success: true, comment })
})

test("comment controller rejects invalid policy IDs and empty comments", async () => {
    const controller = createPolicyCommentController({
        findByIdAndUpdate: () => assert.fail("Invalid comment should not query MongoDB")
    })
    const invalidIdResponse = makeResponse()
    const emptyTextResponse = makeResponse()

    await controller({ body: { policyId: "invalid", text: "Hello" }, auth: { uid: "u1" } }, invalidIdResponse)
    await controller({ body: { policyId, text: "   " }, auth: { uid: "u1" } }, emptyTextResponse)

    assert.equal(invalidIdResponse.statusCode, 400)
    assert.equal(emptyTextResponse.statusCode, 400)
})

test("comment controller returns not found for missing policies", async () => {
    const controller = createPolicyCommentController({
        findByIdAndUpdate: () => ({ select: async () => null })
    })
    const res = makeResponse()

    await controller({ body: { policyId, text: "Hello" }, auth: { uid: "u1" } }, res)

    assert.equal(res.statusCode, 404)
    assert.equal(res.body.error, "Policy not found")
})
