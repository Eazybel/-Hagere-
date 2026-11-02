const test = require("node:test")
const assert = require("node:assert/strict")
const { POLICY_SEED_DATA, seedPolicies } = require("../scripts/seedPolicies")

test("policy seeder upserts ten detailed Ethiopian policy records without replacing engagement data", async () => {
    const calls = []
    let operations
    const fakeMongoose = {
        async connect(uri, options) {
            calls.push(["connect", uri, options.serverSelectionTimeoutMS])
        },
        async disconnect() {
            calls.push(["disconnect"])
        }
    }

    const result = await seedPolicies({
        mongoose: fakeMongoose,
        mongoUri: "mongodb://seed-test/policies",
        Policy: {
            async bulkWrite(items, options) {
                calls.push(["bulkWrite", options])
                operations = items
            }
        },
        logger: { log: message => calls.push(["log", message]) }
    })

    assert.equal(POLICY_SEED_DATA.length, 10)
    assert.equal(result.length, 10)
    assert.equal(operations.length, 10)
    for (const [index, operation] of operations.entries()) {
        const { filter, update, upsert } = operation.updateOne
        assert.deepEqual(filter, { title: POLICY_SEED_DATA[index].title })
        assert.equal(upsert, true)
        assert.equal(update.$set.category, POLICY_SEED_DATA[index].category)
        assert.equal(update.$set.summary, POLICY_SEED_DATA[index].description)
        assert.equal(update.$set.documentUrl, POLICY_SEED_DATA[index].documentUrl)
        assert.match(update.$set.documentUrl, /^https:\/\/\S+$/)
        assert.ok(update.$set.summary.length > 100)
        assert.ok(update.$setOnInsert.interactions.votes.agree.voters instanceof Array)
    }
    assert.deepEqual(calls, [
        ["connect", "mongodb://seed-test/policies", 15_000],
        ["bulkWrite", { ordered: true }],
        ["log", "Successfully seeded 10 Ethiopian policy records!"],
        ["disconnect"]
    ])
})

test("policy seeder disconnects after a database write failure", async () => {
    let disconnected = false
    const fakeMongoose = {
        async connect() {},
        async disconnect() {
            disconnected = true
        }
    }

    await assert.rejects(seedPolicies({
        mongoose: fakeMongoose,
        Policy: { bulkWrite: async () => { throw new Error("write failed") } },
        logger: { log() {} }
    }), /write failed/)
    assert.equal(disconnected, true)
})
