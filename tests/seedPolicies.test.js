const test = require("node:test")
const assert = require("node:assert/strict")
const { POLICY_SEED_DATA, seedPolicies } = require("../scripts/seedPolicies")

const expectedPolicyRecords = [
    {
        title: "Tourism Development Policy (English)",
        description: "Tourism is among the economic and social sectors that are registering rapid growth in the world, serving as a source of foreign exchange, promoting micro and small-scale enterprises, creating employment opportunities, and ensuring sustainable development by establishing coordination among government, private sector, and local communities.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638717/yedev5snr3za6hiuvl86.pdf"
    },
    {
        title: "Education and Training Policy of Ethiopia - Amharic version - 2023",
        description: "Ethiopia's Education and Training Policy is a comprehensive and coherent policy that aims to provide all Ethiopians with access to quality education based on equity, quality, and relevance principles, emphasizing non-formal education to equip adults for workforce participation.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638716/mletiua18iomq6sigevs.pdf"
    },
    {
        title: "National Energy Policy (English)",
        description: "Ethiopia's energy consumption is predominantly based on biomass energy sources (94%), with the remaining met by electricity and petroleum. Addresses critical issues in household fuel supply, deforestation, land degradation, and population growth pressures.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638704/ipcn9y1l6pznjuqnq1xo.pdf"
    },
    {
        title: "Water Policy (English)",
        description: "Outlines Ethiopia's favorable climate and rainfall endowment, addressing the management of its estimated 122 billion cubic meters of annual surface runoff and transboundary river flows to ensure sustainable water resource utilization.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638705/u01t9jmz9msfmhukc7em.pdf"
    },
    {
        title: "The Education and Training Policy and its Implementation (English)",
        description: "Reviews the historical context of modern education in Ethiopia over the past century, focusing on reforming curriculum and training structures to directly address the practical needs of farmers, pastoralists, and overall national development.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638716/mletiua18iomq6sigevs.pdf"
    }
]

test("policy seeder replaces the catalog with the five custom-hosted PDF records", async () => {
    const calls = []
    let insertedPolicies
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
            async deleteMany(filter) {
                calls.push(["deleteMany", filter])
            },
            async insertMany(documents, options) {
                calls.push(["insertMany", options])
                insertedPolicies = documents
                return documents
            }
        },
        logger: { log: message => calls.push(["log", message]) }
    })

    assert.deepEqual(POLICY_SEED_DATA.map(({ title, description, documentUrl }) => ({
        title, description, documentUrl
    })), expectedPolicyRecords)
    assert.equal(result.length, 5)
    assert.equal(insertedPolicies.length, 5)
    for (const [index, policy] of insertedPolicies.entries()) {
        assert.equal(policy.title, expectedPolicyRecords[index].title)
        assert.equal(policy.summary, expectedPolicyRecords[index].description)
        assert.equal(policy.documentUrl, expectedPolicyRecords[index].documentUrl)
        assert.match(policy.documentUrl, /^https:\/\/\S+$/)
        assert.equal(policy.status, "active")
        assert.equal(policy.totalVotes, 0)
        assert.deepEqual(policy.interactions.comments, [])
        assert.deepEqual(policy.interactions.votes, {
            agree: { count: 0, voters: [] },
            neutral: { count: 0, voters: [] },
            disagree: { count: 0, voters: [] }
        })
    }
    assert.deepEqual(calls, [
        ["connect", "mongodb://seed-test/policies", 15_000],
        ["deleteMany", {}],
        ["insertMany", { ordered: true }],
        ["log", "Successfully replaced policies with 5 custom-hosted records!"],
        ["disconnect"]
    ])
})

test("policy seeder disconnects if inserting the replacement catalog fails", async () => {
    let disconnected = false
    const fakeMongoose = {
        async connect() {},
        async disconnect() {
            disconnected = true
        }
    }

    await assert.rejects(seedPolicies({
        mongoose: fakeMongoose,
        Policy: {
            async deleteMany() {},
            async insertMany() {
                throw new Error("insert failed")
            }
        },
        logger: { log() {} }
    }), /insert failed/)
    assert.equal(disconnected, true)
})
