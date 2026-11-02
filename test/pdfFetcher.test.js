const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const https = require("node:https")
const {
    createPdfFetcher,
    PDF_FETCH_TIMEOUT_MS,
    MAX_PDF_BYTES
} = require("../utils/pdfFetcher")

const pdfBytes = Buffer.from("%PDF-1.7 policy contents")
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }]

test("PDF fetcher supports HTTP and HTTPS with bounded, verified, redirect-free Axios requests", async () => {
    for (const url of [
        "http://documents.example.test/policy.pdf",
        "https://documents.example.test/policy.pdf"
    ]) {
        let requestedUrl
        let requestOptions
        const fetchPdfBuffer = createPdfFetcher({
            lookupImpl: publicLookup,
            axiosClient: {
                async get(requestUrl, options) {
                    requestedUrl = requestUrl
                    requestOptions = options
                    return { data: pdfBytes }
                }
            }
        })

        assert.deepEqual(await fetchPdfBuffer(url), pdfBytes)
        assert.equal(requestedUrl, url)
        assert.equal(requestOptions.responseType, "arraybuffer")
        assert.ok(requestOptions.httpAgent instanceof http.Agent)
        assert.ok(requestOptions.httpsAgent instanceof https.Agent)
        assert.equal(requestOptions.httpsAgent.options.rejectUnauthorized, true)
        assert.equal(requestOptions.timeout, PDF_FETCH_TIMEOUT_MS)
        assert.equal(PDF_FETCH_TIMEOUT_MS, 15_000)
        assert.equal(requestOptions.maxContentLength, MAX_PDF_BYTES)
        assert.equal(requestOptions.maxRedirects, 0)
        assert.equal(requestOptions.proxy, false)
    }
})

test("PDF fetcher rejects invalid and private-network URLs before making a request", async () => {
    let requestCount = 0
    const axiosClient = {
        async get() {
            requestCount += 1
            return { data: pdfBytes }
        }
    }
    const fetchPdfBuffer = createPdfFetcher({ axiosClient, lookupImpl: publicLookup })

    await assert.rejects(fetchPdfBuffer("file:///tmp/policy.pdf"), /HTTP or HTTPS/)
    await assert.rejects(fetchPdfBuffer("https://user:pass@documents.example.test/policy.pdf"), /HTTP or HTTPS/)
    await assert.rejects(fetchPdfBuffer("http://127.0.0.1/policy.pdf"), /public IP/)
    const privateDnsFetcher = createPdfFetcher({
        axiosClient,
        lookupImpl: async () => [{ address: "10.0.0.5", family: 4 }]
    })
    await assert.rejects(
        privateDnsFetcher("https://documents.example.test/policy.pdf"),
        /public IP/
    )
    assert.equal(requestCount, 0)
})

test("PDF fetcher rejects oversized responses, non-PDF content, and request timeouts", async () => {
    const oversizedFetcher = createPdfFetcher({
        lookupImpl: publicLookup,
        axiosClient: {
            async get() {
                const error = new Error("maxContentLength size of 14680064 exceeded")
                error.code = "ERR_BAD_RESPONSE"
                throw error
            }
        }
    })
    await assert.rejects(
        oversizedFetcher("https://documents.example.test/policy.pdf"),
        error => error instanceof RangeError && /supported size/.test(error.message)
    )

    const invalidPdfFetcher = createPdfFetcher({
        lookupImpl: publicLookup,
        axiosClient: { async get() { return { data: Buffer.from("not pdf") } } }
    })
    await assert.rejects(
        invalidPdfFetcher("https://documents.example.test/policy.pdf"),
        /not a valid PDF/
    )

    const timedOutFetcher = createPdfFetcher({
        lookupImpl: publicLookup,
        axiosClient: {
            async get() {
                const error = new Error("timeout")
                error.code = "ECONNABORTED"
                throw error
            }
        }
    })
    await assert.rejects(
        timedOutFetcher("https://documents.example.test/policy.pdf"),
        error => error.name === "TimeoutError"
    )
})
