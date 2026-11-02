const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const {
    NEWS_SEED_DATA,
    DNS_CONNECT_RETRIES,
    DNS_RETRY_DELAY_MS,
    isTransientMongoNetworkError,
    seedNews
} = require("../scripts/seedNews")

const noSeedPolicies = { find: () => ({ select: async () => [] }) }
const successfulNewsWrite = { bulkWrite: async operations => operations }

test("news seeder upserts ten policy news posts with linked policies and closes MongoDB", async () => {
    const calls = []
    const mongoUri = "mongodb://seed-test/news"
    const policyId = new mongoose.Types.ObjectId()
    let operations
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
            find(filter) {
                calls.push(["find", filter])
                return { select: async fields => {
                    calls.push(["select", fields])
                    return NEWS_SEED_DATA.map(entry => ({
                        title: entry.relatedPolicyTitle,
                        _id: policyId
                    }))
                } }
            }
        },
        News: {
            async bulkWrite(items) {
                calls.push(["bulkWrite"])
                operations = items
            }
        },
        logger: { log: message => calls.push(["log", message]) }
    })

    assert.equal(NEWS_SEED_DATA.length, 10)
    assert.equal(result.length, 10)
    assert.equal(operations.length, 10)
    assert.equal(operations[0].updateOne.filter.title, NEWS_SEED_DATA[0].title)
    assert.equal(operations[0].updateOne.update.$set.relatedPolicy, policyId)
    assert.equal(operations[0].updateOne.update.$set.imageUrl, NEWS_SEED_DATA[0].imageUrl)
    assert.ok(NEWS_SEED_DATA.every(entry => entry.imageUrl.includes("/960px-")))
    assert.equal(operations[0].updateOne.update.$set.imageSource, NEWS_SEED_DATA[0].imageSource)
    assert.equal(operations[0].updateOne.update.$set.imageCredit, NEWS_SEED_DATA[0].imageCredit)
    assert.equal(new Set(NEWS_SEED_DATA.map(entry => entry.imageUrl)).size, 10)
    assert.ok(NEWS_SEED_DATA.every(entry => entry.imageSource.startsWith("https://commons.wikimedia.org/wiki/File:")))
    assert.equal(operations[0].updateOne.update.$set.author, "Ministry of Finance")
    assert.equal(operations[0].updateOne.update.$setOnInsert.comments[0].userName, "Abebe Tadesse")
    assert.ok(operations[0].updateOne.update.$setOnInsert.comments[0].user instanceof mongoose.Types.ObjectId)
    assert.equal(operations[1].updateOne.update.$setOnInsert.comments[0].userName, "Dawit Kebede")
    assert.equal(operations[0].updateOne.upsert, true)
    assert.deepEqual(calls, [
        ["connect", mongoUri],
        ["find", { title: { $in: [...new Set(NEWS_SEED_DATA.map(entry => entry.relatedPolicyTitle))] } }],
        ["select", "_id title"],
        ["bulkWrite"],
        ["log", "Successfully seeded 10 policy news posts!"],
        ["disconnect"]
    ])
})

test("news seeder supports missing policies and disconnects if upsert fails", async () => {
    let disconnected = false
    let operations
    const fakeMongoose = {
        Types: mongoose.Types,
        async connect() {},
        async disconnect() {
            disconnected = true
        }
    }

    await assert.rejects(seedNews({
        mongoose: fakeMongoose,
        Policy: { find: () => ({ select: async () => [] }) },
        News: {
            async bulkWrite(items) {
                operations = items
                throw new Error("upsert failed")
            }
        },
        logger: { log() {} }
    }), /upsert failed/)

    assert.equal(disconnected, true)
    assert.equal(operations.length, 10)
    assert.equal(operations[0].updateOne.update.$set.relatedPolicy, null)
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
        Policy: noSeedPolicies,
        News: successfulNewsWrite,
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

test("news seeder retries cluster socket timeouts and classifies persistent network errors", async () => {
    let attempts = 0
    const delays = []
    const fakeMongoose = {
        Types: mongoose.Types,
        async connect() {
            attempts += 1
            if (attempts === 1) {
                const error = new Error("connect ETIMEDOUT 203.0.113.10:27017")
                error.name = "MongoNetworkError"
                error.code = "ETIMEDOUT"
                throw error
            }
        },
        async disconnect() {}
    }

    await seedNews({
        mongoose: fakeMongoose,
        Policy: noSeedPolicies,
        News: successfulNewsWrite,
        logger: { log() {}, warn() {} },
        sleep: async milliseconds => delays.push(milliseconds)
    })
    assert.equal(attempts, 2)
    assert.deepEqual(delays, [DNS_RETRY_DELAY_MS])

    const timeout = new Error("connect ETIMEDOUT")
    timeout.code = "ETIMEDOUT"
    assert.equal(isTransientMongoNetworkError(timeout), true)
})

test("news seeder gives Atlas allowlist guidance after persistent socket timeouts", async () => {
    const fakeMongoose = {
        async connect() {
            const error = new Error("connect ETIMEDOUT 203.0.113.10:27017")
            error.name = "MongoNetworkError"
            error.code = "ETIMEDOUT"
            throw error
        }
    }

    await assert.rejects(seedNews({
        mongoose: fakeMongoose,
        sleep: async () => {},
        logger: { warn() {} }
    }), error => {
        assert.match(error.message, /allowlist this machine's public IP/)
        assert.equal(error.cause.code, "ETIMEDOUT")
        return true
    })
})

test("news seeder retries Mongoose server-selection timeout errors", async () => {
    let attempts = 0
    const delays = []
    const fakeMongoose = {
        Types: mongoose.Types,
        async connect() {
            attempts += 1
            if (attempts === 1) {
                const error = new Error("Server selection timed out after 15000 ms")
                error.name = "MongooseServerSelectionError"
                throw error
            }
        },
        async disconnect() {}
    }

    await seedNews({
        mongoose: fakeMongoose,
        Policy: noSeedPolicies,
        News: successfulNewsWrite,
        logger: { log() {}, warn() {} },
        sleep: async milliseconds => delays.push(milliseconds)
    })
    assert.equal(attempts, 2)
    assert.deepEqual(delays, [DNS_RETRY_DELAY_MS])
})
