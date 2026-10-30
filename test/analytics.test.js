const test = require("node:test")
const assert = require("node:assert/strict")
const { buildAnalyticsPipeline, createAnalyticsController } = require("../controller/analyticsController")

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

test("analytics pipeline groups vote and comment totals and ranks policies", () => {
    const pipeline = buildAnalyticsPipeline()
    const project = pipeline[0].$project
    const facets = pipeline[1].$facet

    assert.deepEqual(project.voteCounts, {
        $add: [
            { $ifNull: ["$interactions.votes.agree.count", 0] },
            { $ifNull: ["$interactions.votes.neutral.count", 0] },
            { $ifNull: ["$interactions.votes.disagree.count", 0] }
        ]
    })
    assert.deepEqual(project.commentCount, {
        $size: { $ifNull: ["$interactions.comments", []] }
    })
    assert.deepEqual(facets.topPolicies[1], { $limit: 5 })
    assert.deepEqual(facets.topPolicies[0], { $sort: { voteCounts: -1, createdAt: -1 } })
})

test("analytics controller returns aggregate metrics and active citizen count", async () => {
    const pipeline = buildAnalyticsPipeline()
    const controller = createAnalyticsController({
        Policy: {
            aggregate: async providedPipeline => {
                assert.deepEqual(providedPipeline, pipeline)
                return [{
                    overview: [{
                        totalPolicies: 4,
                        totalVotes: 10,
                        agreeVotes: 5,
                        neutralVotes: 2,
                        disagreeVotes: 3,
                        totalComments: 6
                    }],
                    topPolicies: [{ _id: "p1", title: "Policy One", category: "Health", totalVotes: 8 }]
                }]
            }
        },
        User: {
            countDocuments: async filter => {
                assert.deepEqual(filter, { isActive: true })
                return 7
            }
        }
    })
    const res = makeResponse()

    await controller({}, res, error => { throw error })

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.overview, {
        totalPolicies: 4,
        totalVotes: 10,
        agreeVotes: 5,
        neutralVotes: 2,
        disagreeVotes: 3,
        totalComments: 6,
        activeCitizens: 7
    })
    assert.deepEqual(res.body.topPolicies, [
        { _id: "p1", title: "Policy One", category: "Health", totalVotes: 8 }
    ])
    assert.doesNotThrow(() => new Date(res.body.generatedAt).toISOString())
})

test("analytics controller forwards database failures to Express error handling", async () => {
    const databaseError = new Error("database unavailable")
    const controller = createAnalyticsController({
        Policy: { aggregate: async () => { throw databaseError } },
        User: { countDocuments: async () => 0 }
    })
    let forwardedError

    await controller({}, makeResponse(), error => { forwardedError = error })

    assert.equal(forwardedError, databaseError)
})
