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
    GEMINI_MODEL
} = require("../controller/policyChatController")

const policyId = "507f1f77bcf86cd799439011"
const policyUrl = "https://res.cloudinary.com/hagere/raw/upload/policy.pdf"
const fileUploadUrl = "https://generativelanguage.googleapis.com/upload/file-upload"
const fileUri = "https://generativelanguage.googleapis.com/v1beta/files/gemini-file"
const fileName = "files/gemini-file"
const interactionsUrl = "https://generativelanguage.googleapis.com/v1beta/interactions"

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

function createGeminiFetchMock({ status = "in_progress", pollStatus = "completed", onRequest = () => {} } = {}) {
    const requests = []
    const fetchImpl = async (url, options = {}) => {
        requests.push({ url, options })
        if (url instanceof URL && url.href === policyUrl) {
            return new Response(Buffer.from("%PDF-1.7 policy contents"))
        }
        if (url === `${GEMINI_API_BASE_FOR_TEST}/upload/v1beta/files`) {
            return new Response(null, {
                status: 200,
                headers: { "x-goog-upload-url": fileUploadUrl }
            })
        }
        if (url instanceof URL && url.href === fileUploadUrl) {
            return Response.json({ file: { name: fileName, uri: fileUri } })
        }
        if (url === interactionsUrl && options.method === "POST") {
            onRequest(JSON.parse(options.body), options)
            return Response.json({ id: "interaction_123", status })
        }
        if (url === `${interactionsUrl}/interaction_123`) {
            return Response.json({
                id: "interaction_123",
                status: pollStatus,
                outputs: [{ type: "text", text: "የፖሊሲው መልስ።" }]
            })
        }
        throw new Error(`Unexpected Gemini request: ${String(url)}`)
    }
    return { fetchImpl, requests }
}

const GEMINI_API_BASE_FOR_TEST = "https://generativelanguage.googleapis.com"

test("policy chat uploads and caches the PDF, starts a background answer, and polls it", async () => {
    let interactionBody
    const fetchMock = createGeminiFetchMock({
        onRequest: body => { interactionBody = body }
    })
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "server-side-gemini-key",
        fetchImpl: fetchMock.fetchImpl,
        timeoutSignal: () => new AbortController().signal
    })
    const createResponse = makeResponse()

    await controller.create({
        params: { id: policyId },
        body: { message: "What does this policy say?" }
    }, createResponse)

    assert.equal(createResponse.statusCode, 202)
    assert.deepEqual(createResponse.body, {
        success: true,
        status: "in_progress",
        interactionId: "interaction_123"
    })

    const cloudinaryRequest = fetchMock.requests.find(request => request.url instanceof URL)
    assert.equal(cloudinaryRequest.url.href, policyUrl)
    const uploadStart = fetchMock.requests.find(request => request.url === `${GEMINI_API_BASE_FOR_TEST}/upload/v1beta/files`)
    assert.equal(uploadStart.options.headers["x-goog-api-key"], "server-side-gemini-key")
    assert.equal(uploadStart.options.headers["X-Goog-Upload-Header-Content-Type"], "application/pdf")
    const fileUpload = fetchMock.requests.find(request => request.url instanceof URL && request.url.href === fileUploadUrl)
    assert.equal(fileUpload.options.headers["X-Goog-Upload-Command"], "upload, finalize")
    assert.equal(fileUpload.options.body.toString("ascii", 0, 5), "%PDF-")
    assert.equal(interactionBody.model, GEMINI_MODEL)
    assert.equal(interactionBody.background, true)
    assert.equal(interactionBody.system_instruction, SYSTEM_INSTRUCTION)
    assert.deepEqual(interactionBody.input, [
        { type: "document", uri: fileUri, mime_type: "application/pdf" },
        { type: "text", text: "What does this policy say?" }
    ])

    const pollResponse = makeResponse()
    await controller.poll({
        params: { id: policyId, interactionId: "interaction_123" }
    }, pollResponse)
    assert.equal(pollResponse.statusCode, 200)
    assert.deepEqual(pollResponse.body, {
        success: true,
        status: "completed",
        reply: "የፖሊሲው መልስ።"
    })
    assert.ok(fetchMock.requests.some(request => request.url === `${interactionsUrl}/interaction_123`))
})

test("policy chat caches uploaded documents for follow-up questions", async () => {
    const fetchMock = createGeminiFetchMock()
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "server-side-gemini-key",
        fetchImpl: fetchMock.fetchImpl,
        timeoutSignal: () => new AbortController().signal
    })

    for (const message of ["First question", "Follow-up question"]) {
        const res = makeResponse()
        await controller.create({ params: { id: policyId }, body: { message } }, res)
        assert.equal(res.statusCode, 202)
    }

    assert.equal(fetchMock.requests.filter(request => request.url instanceof URL && request.url.href === policyUrl).length, 1)
    assert.equal(fetchMock.requests.filter(request => request.url === `${GEMINI_API_BASE_FOR_TEST}/upload/v1beta/files`).length, 1)
    assert.equal(fetchMock.requests.filter(request => request.url instanceof URL && request.url.href === fileUploadUrl).length, 1)
    assert.equal(fetchMock.requests.filter(request => request.url === interactionsUrl).length, 2)
})

test("policy chat validates inputs and returns provider errors instead of hiding them", async () => {
    const noFetch = async () => assert.fail("Invalid requests must not fetch")
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "",
        fetchImpl: noFetch,
        timeoutSignal: () => new AbortController().signal
    })
    const invalidIdResponse = makeResponse()
    await controller.create({ params: { id: "invalid" }, body: { message: "Question" } }, invalidIdResponse)
    assert.equal(invalidIdResponse.statusCode, 400)

    const missingMessageResponse = makeResponse()
    await controller.create({ params: { id: policyId }, body: { message: "  " } }, missingMessageResponse)
    assert.equal(missingMessageResponse.statusCode, 400)

    const missingKeyResponse = makeResponse()
    await controller.create({ params: { id: policyId }, body: { message: "Question" } }, missingKeyResponse)
    assert.equal(missingKeyResponse.statusCode, 503)

    const invalidUrlController = createPolicyChatController({
        Policy: {
            findById: () => ({ select: async () => ({ pdfUrl: "https://example.com/policy.pdf" }) })
        },
        apiKey: "server-side-gemini-key",
        fetchImpl: noFetch,
        timeoutSignal: () => new AbortController().signal
    })
    const invalidUrlResponse = makeResponse()
    await invalidUrlController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, invalidUrlResponse)
    assert.equal(invalidUrlResponse.statusCode, 502)
    assert.deepEqual(invalidUrlResponse.body, {
        success: false,
        error: "Policy document URL is invalid"
    })

    const providerErrorController = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "invalid-key",
        fetchImpl: async (url, options = {}) => {
            if (url instanceof URL) return new Response(Buffer.from("%PDF-1.7 policy contents"))
            if (url === `${GEMINI_API_BASE_FOR_TEST}/upload/v1beta/files`) {
                return Response.json({ error: { message: "API key not valid" } }, { status: 403 })
            }
            throw new Error("Unexpected request")
        },
        timeoutSignal: () => new AbortController().signal
    })
    const providerErrorResponse = makeResponse()
    await providerErrorController.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, providerErrorResponse)
    assert.equal(providerErrorResponse.statusCode, 403)
    assert.match(providerErrorResponse.body.error, /API key not valid/)
})

test("policy chat rejects oversized PDFs before sending them to Gemini", async () => {
    let cancelled = false
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
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
                        cancel() { cancelled = true }
                    })
                }
            }
            assert.fail("Oversized PDF must not be uploaded")
        }
    })
    const res = makeResponse()

    await controller.create({
        params: { id: policyId },
        body: { message: "Question" }
    }, res)

    assert.equal(cancelled, true)
    assert.equal(res.statusCode, 413)
    assert.deepEqual(res.body, {
        success: false,
        error: "Policy PDF exceeds the supported size"
    })
})

test("policy chat polls pending and failed interactions with useful errors", async () => {
    const controller = createPolicyChatController({
        Policy: makePolicyModel({ pdfUrl: policyUrl }),
        apiKey: "server-side-gemini-key",
        fetchImpl: async url => {
            if (url.endsWith("/pending_123")) {
                return Response.json({ status: "in_progress" })
            }
            if (url.endsWith("/failed_123")) {
                return Response.json({
                    status: "failed",
                    error: { message: "Model overloaded" }
                })
            }
            throw new Error("Unexpected request")
        },
        timeoutSignal: () => new AbortController().signal
    })
    const pendingResponse = makeResponse()
    await controller.poll({
        params: { id: policyId, interactionId: "pending_123" }
    }, pendingResponse)
    assert.equal(pendingResponse.statusCode, 202)
    assert.deepEqual(pendingResponse.body, { success: true, status: "in_progress" })

    const invalidIdResponse = makeResponse()
    await controller.poll({
        params: { id: policyId, interactionId: "../other" }
    }, invalidIdResponse)
    assert.equal(invalidIdResponse.statusCode, 400)

    const failedResponse = makeResponse()
    await controller.poll({
        params: { id: policyId, interactionId: "failed_123" }
    }, failedResponse)
    assert.equal(failedResponse.statusCode, 502)
    assert.match(failedResponse.body.error, /Model overloaded/)
})
