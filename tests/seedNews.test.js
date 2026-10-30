const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const { NEWS_SEED_DATA, seedNews } = require("../scripts/seedNews")

test("news seeder links four seed posts to an existing policy and closes MongoDB", async () => {
    const calls = []
    const mongoUri = "mongodb://seed-test/news"
    const policyId = new mongoose.Types.ObjectId()
    const insertedDocuments = []
    const seededRows = NEWS_SEED_DATA.map((entry, index) => ({ ...entry, _id: index }))
    const fakeMongoose = {
        Types: mongoose.Types,
        async connect(uri) {
            calls.push(["connect", uri])
        },
        async disconnect() {
            calls.push(["disconnect"])
        }
    }
    const result = await seedNews({
        mongoose: fakeMongoose,
        mongoUri,
        Policy: {
            findOne() {
                calls.push(["findOne"])
                return { select: async fields => {
                    calls.push(["select", fields])
                    return { _id: policyId }
                } }
            }
        },
        News: {
            async deleteMany(filter) {
                calls.push(["deleteMany", filter])
            },
            async insertMany(documents) {
                calls.push(["insertMany"])
                insertedDocuments.push(...documents)
                return seededRows
            }
        },
        logger: { log: message => calls.push(["log", message]) }
    })

    assert.equal(result.length, 4)
    assert.equal(insertedDocuments.length, 4)
    assert.equal(insertedDocuments[0].relatedPolicy, policyId)
    assert.equal(insertedDocuments[0].imageUrl, NEWS_SEED_DATA[0].imageUrl)
    assert.equal(insertedDocuments[0].author, "Government Communication Service")
    assert.equal(insertedDocuments[0].comments[0].userName, "Abebe Tadesse")
    assert.ok(insertedDocuments[0].comments[0].user instanceof mongoose.Types.ObjectId)
    assert.equal(insertedDocuments[1].comments[0].userName, "Dawit Kebede")
    assert.deepEqual(calls, [
        ["connect", mongoUri],
        ["findOne"],
        ["select", "_id"],
        ["deleteMany", {}],
        ["insertMany"],
        ["log", "Successfully seeded 4 policy news posts!"],
        ["disconnect"]
    ])
})

test("news seeder supports no existing policies and disconnects if insertion fails", async () => {
    let disconnected = false
    let insertedDocuments
    const fakeMongoose = {
        Types: mongoose.Types,
        async connect() {},
        async disconnect() {
            disconnected = true
        }
    }

    await assert.rejects(seedNews({
        mongoose: fakeMongoose,
        Policy: { findOne: () => ({ select: async () => null }) },
        News: {
            async deleteMany() {},
            async insertMany(documents) {
                insertedDocuments = documents
                throw new Error("insert failed")
            }
        },
        logger: { log() {} }
    }), /insert failed/)

    assert.equal(disconnected, true)
    assert.equal(insertedDocuments.length, 4)
    assert.equal(insertedDocuments[0].relatedPolicy, null)
})
