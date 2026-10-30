const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const express = require("express")
const request = require("supertest")

test("news page and its Firebase module dependencies are served as static assets", async () => {
    const app = express()
    app.use(express.static(path.join(__dirname, "..", "public")))

    const [page, script, firebaseInit] = await Promise.all([
        request(app).get("/news.html"),
        request(app).get("/news.js"),
        request(app).get("/firebaseInit.js")
    ])

    assert.equal(page.status, 200)
    assert.match(page.text, /src="\.\/news\.js"/)
    assert.equal(script.status, 200)
    assert.match(script.text, /from "\.\/firebaseInit\.js"/)
    assert.equal(firebaseInit.status, 200)
    assert.match(firebaseInit.text, /export const auth = getAuth\(app\)/)
})
