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
    MAX_PDF_BYTES
} = require("../controller/policyChatController")

const policyId = "507f1f77bcf86cd799439011"
const policyUrl = "https://res.cloudinary.com/hagere/raw/upload/policy.pdf"

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

function makePolicyModel(policy) {
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

test("policy chat sends the selected PDF and question to Gemini and returns its answer", async () => {
    const pdfBytes = Buffer.from("%PDF-1.7 policy contents")
    let geminiRequest
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "server-side-gemini-key",
        fetchImpl: async (url, options) => {
            if (url instanceof URL) {
                assert.equal(url.href, policyUrl)
                assert.equal(options.redirect, "error")
                return new Response(pdfBytes, {
                    headers: { "Content-Type": "application/pdf" }
                })
            }
            geminiRequest = { url, options }
            return Response.json({
                candidates: [{
                    content: { parts: [{ text: "የፖሊሲው መልስ።" }] }
                }]
            })
        }
    })
    const res = makeResponse()

    await controller({
        params: { id: policyId },
        body: { message: "What does this policy say?" }
    }, res)

    assert.equal(geminiRequest.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent")
    assert.equal(geminiRequest.options.headers["x-goog-api-key"], "server-side-gemini-key")
    const requestBody = JSON.parse(geminiRequest.options.body)
    assert.deepEqual(requestBody.systemInstruction, { parts: [{ text: SYSTEM_INSTRUCTION }] })
    assert.equal(requestBody.contents[0].parts[0].text, "What does this policy say?")
    assert.deepEqual(requestBody.contents[0].parts[1].inlineData, {
        mimeType: "application/pdf",
        data: pdfBytes.toString("base64")
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { success: true, reply: "የፖሊሲው መልስ።" })
})

test("policy chat validates inputs, document URLs, and missing configuration", async () => {
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "",
        fetchImpl: async () => assert.fail("Invalid requests must not fetch")
    })
    const invalidIdResponse = makeResponse()
    await controller({ params: { id: "invalid" }, body: { message: "Question" } }, invalidIdResponse)
    assert.equal(invalidIdResponse.statusCode, 400)

    const missingMessageResponse = makeResponse()
    await controller({ params: { id: policyId }, body: { message: "  " } }, missingMessageResponse)
    assert.equal(missingMessageResponse.statusCode, 400)

    const missingKeyResponse = makeResponse()
    await controller({ params: { id: policyId }, body: { message: "Question" } }, missingKeyResponse)
    assert.equal(missingKeyResponse.statusCode, 503)
    assert.deepEqual(missingKeyResponse.body, {
        success: false,
        error: "Policy assistant is not configured"
    })

    let queried = false
    const invalidUrlController = createPolicyChatController({
        Policy: {
            findById: () => ({
                select: async () => {
                    queried = true
                    return { pdfUrl: "https://example.com/policy.pdf" }
                }
            })
        },
        apiKey: "server-side-gemini-key",
        fetchImpl: async () => assert.fail("Untrusted document hosts must not be fetched")
    })
    const invalidUrlResponse = makeResponse()
    await invalidUrlController({
        params: { id: policyId },
        body: { message: "Question" }
    }, invalidUrlResponse)
    assert.equal(queried, true)
    assert.equal(invalidUrlResponse.statusCode, 502)
    assert.deepEqual(invalidUrlResponse.body, {
        success: false,
        error: "Policy document URL is invalid"
    })
})

test("policy chat rejects oversized PDF downloads", async () => {
    let cancelled = false
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "server-side-gemini-key",
        fetchImpl: async () => ({
            ok: true,
            headers: new Headers(),
            body: new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(MAX_PDF_BYTES))
                    controller.enqueue(new Uint8Array(1))
                },
                cancel() {
                    cancelled = true
                }
            })
        })
    })
    const res = makeResponse()

    await controller({
        params: { id: policyId },
        body: { message: "Question" }
    }, res)

    assert.equal(cancelled, true)
    assert.equal(res.statusCode, 413)
    assert.deepEqual(res.body, {
        success: false,
        error: "Policy PDF exceeds the supported 14 MB size"
    })
})
