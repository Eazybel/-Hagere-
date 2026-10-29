const test = require("node:test")
const assert = require("node:assert/strict")

process.env.NODE_ENV = "test"
process.env.PORT = "3000"
process.env.CONNECTION_STRING = "mongodb://127.0.0.1:27017/hagere-test"
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud"
process.env.CLOUDINARY_KEY = "test-key"
process.env.CLOUDINARY_SECRET = "test-secret"
process.env.FIREBASE_API = "test-api-key"
process.env.SERVICE_ACCOUNT = JSON.stringify({
    type: "service_account",
    project_id: "citizen-project",
    private_key: "test-key",
    client_email: "service@citizen-project.iam.gserviceaccount.com",
    client_id: "citizen-client"
})
process.env.ADMIN_FIREBASE_PROJECT_ID = "admin-project"
process.env.ADMIN_SERVICE_ACCOUNT = JSON.stringify({
    type: "service_account",
    project_id: "admin-project",
    private_key: "test-key",
    client_email: "service@admin-project.iam.gserviceaccount.com",
    client_id: "admin-client"
})
process.env.ADMIN_UIDS = "approved-admin"

const {
    createPolicyChatController,
    SYSTEM_INSTRUCTION,
    MAX_PDF_BYTES,
    CLOUDINARY_FETCH_TIMEOUT_MS,
    GEMINI_MODEL
} = require("../controller/policyChatController")

const policyId = "507f1f77bcf86cd799439011"
const policyUrl = "https://res.cloudinary.com/hagere/raw/upload/policy.pdf"
const cloudinaryUrl = new URL(policyUrl)
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const pdfBytes = Buffer.from("%PDF-1.7 policy contents")

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

function makePolicyModel(policy = { pdfUrl: policyUrl }) {
    return {
        findById(id) {
            assert.equal(id, policyId)
            return {
                select(fields) {
                    assert.equal(fields, "pdfUrl")
                    return Promise.resolve(policy)
                }
            }
        }
    }
}

function createPdfFetchMock({ geminiResponse = null, onGeminiRequest = () => {} } = {}) {
    const requests = []
    const fetchImpl = async (url, options = {}) => {
        requests.push({ url, options })
        if (url instanceof URL && url.href === cloudinaryUrl.href) {
            return new Response(pdfBytes, {
                headers: { "content-type": "application/pdf" }
            })
        }
        if (url === geminiUrl) {
            onGeminiRequest(options)
            return geminiResponse || Response.json({
                candidates: [{
                    content: {
                        parts: [{ text: "የፖሊሲው መልስ።" }]
                    }
                }]
            })
        }
        throw new Error(`Unexpected request: ${String(url)}`)
    }
    return { fetchImpl, requests }
}

test("policy chat sends the PDF as base64 inline data and returns Gemini's answer", async () => {
    let geminiOptions
    const fetchMock = createPdfFetchMock({
        onGeminiRequest: options => { geminiOptions = options }
    })
    const controller = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl: fetchMock.fetchImpl
    })
    const res = makeResponse()

    await controller.create({
        params: { id: policyId },
        body: { message: "What does this policy say?" }
    }, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { success: true, reply: "የፖሊሲው መልስ።" })
    const cloudinaryRequest = fetchMock.requests.find(request => request.url instanceof URL)
    assert.equal(cloudinaryRequest.url.href, cloudinaryUrl.href)
    assert.ok(cloudinaryRequest.options.signal instanceof AbortSignal)
    assert.equal(geminiOptions.headers["x-goog-api-key"], "server-side-gemini-key")
    assert.deepEqual(JSON.parse(geminiOptions.body), {
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: "application/pdf",
                        data: pdfBytes.toString("base64")
                    }
                },
                { text: "What does this policy say?" }
            ]
        }]
    })
    assert.equal(SYSTEM_INSTRUCTION, "You are an expert AI civic assistant for Hagere. Read the attached policy document carefully, and answer the user's question accurately and thoroughly in Amharic (አማርኛ).")
    assert.equal(fetchMock.requests.find(request => request.url === geminiUrl).url.includes("?key="), false)
})

test("Cloudinary PDF fetch has a strict 10-second AbortController timeout", async () => {
    let cloudinarySignal
    const fetchImpl = async (url, options = {}) => {
        if (url instanceof URL && url.href === cloudinaryUrl.href) {
            cloudinarySignal = options.signal
            return new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })
            })
        }
        throw new Error(`Unexpected request: ${String(url)}`)
    }
    const controller = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl,
        cloudinaryTimeoutMs: 5
    })
    const res = makeResponse()

    await controller.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, res)

    assert.equal(CLOUDINARY_FETCH_TIMEOUT_MS, 10_000)
    assert.equal(cloudinarySignal.aborted, true)
    assert.equal(res.statusCode, 504)
    assert.match(res.body.error, /timed out/i)
})

test("Cloudinary timeout also bounds a stalled PDF body after headers", async () => {
    const fetchImpl = async (url, options = {}) => {
        if (url instanceof URL && url.href === cloudinaryUrl.href) {
            return {
                ok: true,
                headers: new Headers(),
                body: new ReadableStream({
                    start() {},
                    cancel() {}
                })
            }
        }
        throw new Error(`Unexpected request: ${String(url)}`)
    }
    const controller = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl,
        cloudinaryTimeoutMs: 5
    })
    const res = makeResponse()

    await controller.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, res)

    assert.equal(res.statusCode, 504)
    assert.match(res.body.error, /timed out/i)
})

test("policy chat returns JSON for invalid input, missing policy, and unavailable configuration", async () => {
    const noFetch = async () => assert.fail("Invalid requests must not fetch")
    const controller = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "",
        fetchImpl: noFetch
    })

    const invalidId = makeResponse()
    await controller.create({ params: { id: "invalid" }, body: { message: "Question" } }, invalidId)
    assert.equal(invalidId.statusCode, 400)

    const emptyMessage = makeResponse()
    await controller.create({ params: { id: policyId }, body: { message: " " } }, emptyMessage)
    assert.equal(emptyMessage.statusCode, 400)

    const noKey = makeResponse()
    await controller.create({ params: { id: policyId }, body: { message: "Question" } }, noKey)
    assert.equal(noKey.statusCode, 503)

    const missingPolicy = createPolicyChatController({
        Policy: makePolicyModel(null),
        apiKey: "server-side-gemini-key",
        fetchImpl: noFetch
    })
    const missing = makeResponse()
    await missingPolicy.create({ params: { id: policyId }, body: { message: "Question" } }, missing)
    assert.equal(missing.statusCode, 404)

    const databaseErrorController = createPolicyChatController({
        Policy: {
            findById() {
                throw new Error("database unavailable")
            }
        },
        apiKey: "server-side-gemini-key",
        fetchImpl: noFetch
    })
    const databaseError = makeResponse()
    await databaseErrorController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, databaseError)
    assert.equal(databaseError.statusCode, 500)
    assert.deepEqual(databaseError.body, { success: false, error: "Unable to load this policy" })
})

test("policy chat rejects oversized, invalid, and unavailable Cloudinary PDFs with JSON errors", async () => {
    let cancelled = false
    const oversizedController = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl: async url => {
            if (url instanceof URL) {
                return {
                    ok: true,
                    headers: new Headers(),
                    body: new ReadableStream({
                        start(stream) {
                            stream.enqueue(new Uint8Array(MAX_PDF_BYTES))
                            stream.enqueue(new Uint8Array(1))
                        },
                        cancel() {
                            cancelled = true
                        }
                    })
                }
            }
            throw new Error(`Unexpected request: ${String(url)}`)
        }
    })
    const oversized = makeResponse()
    await oversizedController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, oversized)
    assert.equal(oversized.statusCode, 413)
    assert.equal(cancelled, true)

    const invalidPdfController = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl: async () => new Response("not a PDF")
    })
    const invalidPdf = makeResponse()
    await invalidPdfController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, invalidPdf)
    assert.equal(invalidPdf.statusCode, 502)
    assert.match(invalidPdf.body.error, /not a valid PDF/)
})

test("Gemini HTTP errors, timeouts, and empty responses are returned as JSON", async () => {
    const forbiddenMock = createPdfFetchMock({
        geminiResponse: Response.json(
            { error: { message: "API key not valid" } },
            { status: 403 }
        )
    })
    const forbiddenController = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "invalid-key",
        fetchImpl: forbiddenMock.fetchImpl
    })
    const forbidden = makeResponse()
    await forbiddenController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, forbidden)
    assert.equal(forbidden.statusCode, 503)
    assert.match(forbidden.body.error, /API key not valid/)

    const networkFailureController = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl: async url => {
            if (url instanceof URL) return new Response(pdfBytes)
            throw new TypeError("Gemini connection reset")
        }
    })
    const networkFailure = makeResponse()
    await networkFailureController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, networkFailure)
    assert.equal(networkFailure.statusCode, 502)
    assert.match(networkFailure.body.error, /Gemini connection reset/)

    const timeoutMock = createPdfFetchMock({
        onGeminiRequest: options => {
            options.signal.addEventListener("abort", () => {}, { once: true })
        }
    })
    timeoutMock.fetchImpl = async (url, options = {}) => {
        if (url instanceof URL) return new Response(pdfBytes)
        if (url === geminiUrl) {
            return new Promise((resolve, reject) => {
                options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })
            })
        }
        throw new Error(`Unexpected request: ${String(url)}`)
    }
    const timeoutController = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl: timeoutMock.fetchImpl,
        timeoutMs: 5
    })
    const timeoutResponse = makeResponse()
    await timeoutController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, timeoutResponse)
    assert.equal(timeoutResponse.statusCode, 504)

    const emptyMock = createPdfFetchMock({
        geminiResponse: Response.json({ candidates: [] })
    })
    const emptyController = createPolicyChatController({
        Policy: makePolicyModel(),
        apiKey: "server-side-gemini-key",
        fetchImpl: emptyMock.fetchImpl
    })
    const empty = makeResponse()
    await emptyController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, empty)
    assert.equal(empty.statusCode, 502)
    assert.match(empty.body.error, /returned no answer/)
})
