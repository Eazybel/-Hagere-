const test = require("node:test")
const assert = require("node:assert/strict")
const express = require("express")
const { once } = require("node:events")
const { authRateLimit } = require("../controller/rateLimitController")

test("authentication limiter blocks requests over its configured limit", async t => {
    const app = express()
    app.post("/auth", authRateLimit, (req, res) => res.sendStatus(204))
    const server = app.listen(0, "127.0.0.1")
    await once(server, "listening")
    t.after(() => new Promise(resolve => server.close(resolve)))

    const address = server.address()
    const url = `http://127.0.0.1:${address.port}/auth`
    let lastResponse

    for (let request = 0; request < 11; request += 1) {
        lastResponse = await fetch(url, { method: "POST" })
    }

    assert.equal(lastResponse.status, 429)
    assert.deepEqual(await lastResponse.json(), {
        success: false,
        message: "Too many requests. Please try again later."
    })
})
