const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const { createPolicyLikeController } = require("../controller/policyLikeController")

const policyId = "507f1f77bcf86cd799439011"
const userId = new mongoose.Types.ObjectId()

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

test("policy like endpoint toggles the authenticated user's like", async () => {
    let likes = []
    const controller = createPolicyLikeController({
        User: {
            findOne: async filter => {
                assert.deepEqual(filter, { email: "citizen@example.com" })
                return { _id: userId }
            }
        },
        Policy: {
            findOneAndUpdate(filter, update) {
                const incoming = update.$addToSet.likes
                assert.equal(filter._id, policyId)
                const liked = !likes.some(id => id.equals(incoming))
                if (liked) likes = [...likes, incoming]
                return {
                    select: async () => liked ? { likes: [...likes] } : null
                }
            },
            findByIdAndUpdate(id, update) {
                assert.equal(id, policyId)
                likes = likes.filter(existing => !existing.equals(update.$pull.likes))
                return { select: async () => ({ likes: [...likes] }) }
            }
        }
    })

    const liked = makeResponse()
    await controller({ params: { id: policyId }, auth: { email: "citizen@example.com" } }, liked)
    assert.deepEqual(liked.body, { success: true, liked: true, likesCount: 1 })

    const unliked = makeResponse()
    await controller({ params: { id: policyId }, auth: { email: "citizen@example.com" } }, unliked)
    assert.deepEqual(unliked.body, { success: true, liked: false, likesCount: 0 })
})

test("policy like endpoint rejects invalid IDs and missing registered citizens", async () => {
    const controller = createPolicyLikeController({
        User: { findOne: async () => null },
        Policy: { findOneAndUpdate: () => assert.fail("Invalid user must not update policy") }
    })
    const invalid = makeResponse()
    await controller({ params: { id: "invalid" }, auth: { email: "citizen@example.com" } }, invalid)
    assert.equal(invalid.statusCode, 400)

    const missingUser = makeResponse()
    await controller({ params: { id: policyId }, auth: { email: "citizen@example.com" } }, missingUser)
    assert.equal(missingUser.statusCode, 404)
})
