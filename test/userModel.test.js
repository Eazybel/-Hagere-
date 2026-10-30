const test = require("node:test")
const assert = require("node:assert/strict")
const User = require("../models/User")

test("User model loads and uses the existing users collection", () => {
    assert.equal(User.modelName, "User")
    assert.equal(User.collection.name, "users")
})

test("User model preserves profile, role, activity, and vote defaults", async () => {
    const user = new User({
        name: "  Test Citizen  ",
        email: "CITIZEN@EXAMPLE.COM",
        votesCast: [{ policyId: "policy-1", stance: "agree" }]
    })

    await user.validate()

    assert.equal(user.name, "Test Citizen")
    assert.equal(user.email, "citizen@example.com")
    assert.equal(user.avatar, "")
    assert.equal(user.role, "citizen")
    assert.equal(user.isActive, true)
    assert.equal(user.votesCast.length, 1)
    assert.ok(user.votesCast[0].votedAt instanceof Date)
    assert.equal(User.schema.options.timestamps, true)
})

test("User model requires a name and email", async () => {
    const user = new User({})

    await assert.rejects(user.validate(), error => {
        assert.ok(error.errors.name)
        assert.ok(error.errors.email)
        return true
    })
})
