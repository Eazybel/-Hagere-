const test = require("node:test")
const assert = require("node:assert/strict")
const AppError = require("../errors/AppError")
const { notFoundHandler, errorHandler } = require("../middleware/errorHandler")

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

test("AppError exposes a safe message and its HTTP status", () => {
    const res = makeResponse()

    errorHandler(new AppError("Policy not found", 404), {}, res, assert.fail)

    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.body, { success: false, message: "Policy not found" })
})

test("unexpected errors return a generic response without leaking details", () => {
    const res = makeResponse()
    const originalConsoleError = console.error
    let loggedError
    console.error = error => { loggedError = error }

    try {
        errorHandler(new Error("database credentials leaked"), {}, res, assert.fail)
    } finally {
        console.error = originalConsoleError
    }

    assert.equal(loggedError.message, "database credentials leaked")
    assert.equal(res.statusCode, 500)
    assert.deepEqual(res.body, { success: false, message: "Internal server error" })
})

test("malformed JSON receives a safe client error response", () => {
    const res = makeResponse()

    errorHandler({ type: "entity.parse.failed", message: "Parser internals" }, {}, res, assert.fail)

    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, { success: false, message: "Invalid JSON request body" })
})

test("unknown routes pass a standard 404 AppError to the error handler", () => {
    let forwardedError

    notFoundHandler({}, {}, error => { forwardedError = error })

    assert.ok(forwardedError instanceof AppError)
    assert.equal(forwardedError.statusCode, 404)
    assert.equal(forwardedError.message, "Route not found")
})
