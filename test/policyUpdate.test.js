const test = require("node:test")
const assert = require("node:assert/strict")
const { EventEmitter } = require("node:events")

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
    createPolicyUpdateController,
    createPolicyListController
} = require("../controller/policyController")

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

function createUpload(result, error) {
    let options
    let fileBuffer
    return {
        cloudinary: {
            uploader: {
                upload_stream(uploadOptions, callback) {
                    options = uploadOptions
                    const stream = new EventEmitter()
                    stream.end = buffer => {
                        fileBuffer = buffer
                        callback(error, result)
                    }
                    return stream
                }
            }
        },
        getOptions: () => options,
        getFileBuffer: () => fileBuffer
    }
}

test("policy publishing uploads the document and maps form fields to the schema", async () => {
    let policyData
    let saved = false
    const upload = createUpload({ url: "http://cloudinary/policy.pdf", secure_url: "https://cloudinary/policy.pdf" })
    class Policy {
        constructor(data) {
            policyData = data
            this.id = "policy-id"
        }
        async save() {
            saved = true
        }
    }
    const controller = createPolicyUpdateController({ Policy, cloudinary: upload.cloudinary })
    const res = makeResponse()

    await controller({
        body: { title: "  Policy title  ", sector: "  Economy  ", description: "  Summary  ", status: "active" },
        file: { buffer: Buffer.from("pdf") }
    }, res)

    assert.deepEqual(upload.getOptions(), { folder: "policyFiles", resource_type: "auto" })
    assert.equal(upload.getFileBuffer().toString(), "pdf")
    assert.deepEqual(policyData, {
        title: "Policy title",
        category: "Economy",
        summary: "Summary",
        pdfUrl: "http://cloudinary/policy.pdf",
        status: "active"
    })
    assert.equal(saved, true)
    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, {
        policyId: "policy-id",
        pdfUrl: "https://cloudinary/policy.pdf"
    })
})

test("policy publishing returns JSON errors for missing input, failed uploads, and failed saves", async () => {
    const upload = createUpload({ url: "http://cloudinary/policy.pdf" })
    const shouldNotSave = createPolicyUpdateController({
        Policy: { save: () => assert.fail("Invalid policy should not be saved") },
        cloudinary: upload.cloudinary
    })
    const missingFileResponse = makeResponse()
    await shouldNotSave({ body: {} }, missingFileResponse)
    assert.equal(missingFileResponse.statusCode, 400)
    assert.equal(typeof missingFileResponse.body.error, "string")

    const missingFieldsResponse = makeResponse()
    await shouldNotSave({
        body: { title: "Title", sector: "", description: "Summary" },
        file: { buffer: Buffer.from("pdf") }
    }, missingFieldsResponse)
    assert.equal(missingFieldsResponse.statusCode, 400)
    assert.equal(typeof missingFieldsResponse.body.error, "string")

    const failedUpload = createUpload(null, new Error("upload failed"))
    const uploadFailureController = createPolicyUpdateController({
        Policy: { save: () => assert.fail("Failed upload should not save a policy") },
        cloudinary: failedUpload.cloudinary
    })
    const uploadFailureResponse = makeResponse()
    await uploadFailureController({
        body: { title: "Title", sector: "Economy", description: "Summary" },
        file: { buffer: Buffer.from("pdf") }
    }, uploadFailureResponse)
    assert.equal(uploadFailureResponse.statusCode, 502)
    assert.deepEqual(uploadFailureResponse.body, { error: "Policy document upload failed" })

    class FailingPolicy {
        constructor() {
            this.id = "policy-id"
        }
        async save() {
            throw new Error("database unavailable")
        }
    }
    const saveFailureController = createPolicyUpdateController({
        Policy: FailingPolicy,
        cloudinary: upload.cloudinary
    })
    const saveFailureResponse = makeResponse()
    await saveFailureController({
        body: { title: "Title", sector: "Economy", description: "Summary" },
        file: { buffer: Buffer.from("pdf") }
    }, saveFailureResponse)
    assert.equal(saveFailureResponse.statusCode, 500)
    assert.deepEqual(saveFailureResponse.body, { error: "Policy could not be saved" })
})

test("policy feed returns live database policies newest-first without caching", async () => {
    const policies = [
        { _id: "newest", title: "Newest", interactions: {} },
        { _id: "older", title: "Older", interactions: {} }
    ]
    let sortCriteria
    let cacheControl
    const controller = createPolicyListController({
        Policy: {
            find: () => ({
                sort(criteria) {
                    sortCriteria = criteria
                    return Promise.resolve(policies)
                }
            })
        }
    })
    const res = makeResponse()
    res.set = (name, value) => {
        if (name === "Cache-Control") cacheControl = value
        return res
    }

    await controller({}, res, error => { throw error })

    assert.deepEqual(sortCriteria, { createdAt: -1 })
    assert.equal(cacheControl, "no-store")
    assert.deepEqual(res.body.map(policy => policy._id), ["newest", "older"])
    assert.equal(res.statusCode, 200)
})
