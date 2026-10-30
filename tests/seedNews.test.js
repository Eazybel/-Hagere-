const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const {
    NEWS_SEED_DATA,
    DNS_CONNECT_RETRIES,
    DNS_RETRY_DELAY_MS,
    seedNews
} = require("../scripts/seedNews")

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

test("news seeder retries transient Atlas SRV DNS failures before continuing", async () => {
    let attempts = 0
    const delays = []
    const fakeMongoose = {
        Types: mongoose.Types,
        async connect() {
            attempts += 1
            if (attempts === 1) {
                const error = new Error("querySrv ESERVFAIL _mongodb._tcp.cluster.example.mongodb.net")
                error.code = "ESERVFAIL"
                throw error
            }
        },
        async disconnect() {}
    }

    await seedNews({
        mongoose: fakeMongoose,
        Policy: { findOne: () => ({ select: async () => null }) },
        News: {
            async deleteMany() {},
            async insertMany(documents) { return documents }
        },
        logger: { log() {}, warn() {} },
        sleep: async milliseconds => delays.push(milliseconds)
    })

    assert.equal(DNS_CONNECT_RETRIES, 2)
    assert.equal(DNS_RETRY_DELAY_MS, 2000)
    assert.equal(attempts, 2)
    assert.deepEqual(delays, [2000])
})

test("news seeder reports persistent SRV DNS failure with a remediation hint", async () => {
    let attempts = 0
    const fakeMongoose = {
        async connect() {
            attempts += 1
            const error = new Error("querySrv ESERVFAIL _mongodb._tcp.cluster.example.mongodb.net")
            error.code = "ESERVFAIL"
            throw error
        }
    }

    await assert.rejects(seedNews({
        mongoose: fakeMongoose,
        sleep: async () => {},
        logger: { warn() {} }
    }), error => {
        assert.match(error.message, /Check the network's DNS resolver/)
        assert.equal(error.cause.code, "ESERVFAIL")
        return true
    })
    assert.equal(attempts, 3)
})
