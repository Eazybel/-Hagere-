const test = require("node:test")
const assert = require("node:assert/strict")
const { applyOptimisticVote } = require("../public/voteState.mjs")

test("optimistic vote updates the selected count immediately", () => {
    const counts = { agree: 4, neutral: 2, disagree: 1 }

    applyOptimisticVote(counts, "neutral")

    assert.deepEqual(counts, { agree: 4, neutral: 3, disagree: 1 })
})

test("vote rollback restores all previous counts after request failure", () => {
    const counts = { agree: 4, neutral: 2, disagree: 1 }
    const rollback = applyOptimisticVote(counts, "agree")

    rollback()

    assert.deepEqual(counts, { agree: 4, neutral: 2, disagree: 1 })
})

test("optimistic vote rejects unsupported stances", () => {
    assert.throws(
        () => applyOptimisticVote({ agree: 1, neutral: 0, disagree: 0 }, "invalid"),
        { name: "TypeError", message: "Invalid voting stance" }
    )
})
