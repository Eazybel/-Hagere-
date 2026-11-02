/**
 * @file policyChatController.js
 * @description Retrieves bounded PDF content from public HTTPS URLs and sends policy-grounded questions to Gemini with timeout/retry handling.
 * @module Controllers/PolicyChat
 * @requires mongoose and Node.js HTTPS, DNS, fetch, Buffer, and AbortController APIs
 */
const mongoose = require("mongoose")
const { lookup } = require("node:dns/promises")
const { isIP } = require("node:net")
const { request: httpsRequest } = require("node:https")
const { Readable } = require("node:stream")

const SYSTEM_INSTRUCTION = "You are an expert AI civic assistant for Hagere. Read the attached policy document carefully, and answer the user's question accurately and thoroughly in Amharic (አማርኛ)."
const MAX_MESSAGE_LENGTH = 4000
const MAX_PDF_BYTES = 14 * 1024 * 1024
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com"
const GEMINI_MODEL = "gemini-3.1-flash-lite"
const PDF_FETCH_TIMEOUT_MS = 10_000
const GEMINI_REQUEST_TIMEOUT_MS = 90_000
const GEMINI_503_RETRIES = 2
const GEMINI_RETRY_DELAY_MS = 2000

/**
 * Restricts policy document retrieval to credential-free HTTPS URLs resolving only to public IPs.
 * @param {string} pdfUrl Stored policy document URL.
 * @param {Function} lookupImpl DNS lookup implementation.
 * @returns {Promise<{url: URL, addresses: object[]}>} Validated public HTTPS destination.
 */
async function getPublicPdfUrl(pdfUrl, lookupImpl) {
    let url
    try {
        url = new URL(pdfUrl)
    } catch {
        throw new Error("Policy document URL is invalid")
    }

    if (url.protocol !== "https:"
        || url.username
        || url.password
        || (url.port && url.port !== "443")) {
        throw new Error("Policy document URL must use HTTPS without embedded credentials")
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, "")
    const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await lookupImpl(hostname, { all: true, verbatim: true })
    if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
        throw new Error("Policy document URL must resolve only to public IP addresses")
    }

    return { url, addresses }
}

function createPinnedLookup(addresses) {
    return (hostname, options, callback) => {
        if (typeof options === "function") {
            callback = options
            options = {}
        }
        options = options || {}
        const matchingAddresses = addresses.filter(({ family }) =>
            !options.family || family === options.family
        )
        if (!matchingAddresses.length) {
            callback(new Error("No public IP address available for policy PDF host"))
            return
        }
        if (options.all) {
            callback(null, matchingAddresses)
            return
        }
        callback(null, matchingAddresses[0].address, matchingAddresses[0].family)
    }
}

function fetchPinnedPdf(url, addresses, signal) {
    return new Promise((resolve, reject) => {
        const request = httpsRequest(url, {
            method: "GET",
            signal,
            lookup: createPinnedLookup(addresses)
        }, response => {
            const headers = new Headers()
            for (const [name, value] of Object.entries(response.headers)) {
                if (value !== undefined) {
                    headers.set(name, Array.isArray(value) ? value.join(", ") : value)
                }
            }
            const ok = response.statusCode >= 200 && response.statusCode < 300
            if (!ok) response.resume()
            resolve({
                ok,
                status: response.statusCode,
                headers,
                body: ok ? Readable.toWeb(response) : null
            })
        })
        request.once("error", reject)
        request.end()
    })
}

function isPublicIp(address) {
    const family = isIP(address)
    if (family === 4) {
        const octets = address.split(".").map(Number)
        const value = octets.reduce((result, octet) => result * 256 + octet, 0)
        const blockedRanges = [
            [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
            [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
            [0xc0586300, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24],
            [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4]
        ]
        return !blockedRanges.some(([network, prefix]) =>
            Math.floor(value / 2 ** (32 - prefix)) === Math.floor(network / 2 ** (32 - prefix))
        )
    }
    if (family !== 6) return false

    const normalized = address.toLowerCase()
    if (normalized.startsWith("::ffff:")) {
        return isPublicIp(normalized.slice(7))
    }
    return /^[23]/.test(normalized) && !normalized.startsWith("2001:db8:")
}

/**
 * Races asynchronous work with an abort signal and unregisters its listener afterward.
 * @param {Promise<*>} promise Asynchronous work to observe.
 * @param {AbortSignal} signal Cancellation signal.
 * @param {Function} [onAbort] Optional cancellation cleanup callback.
 * @returns {Promise<*>} Result of work or abort rejection.
 */
function raceWithAbort(promise, signal, onAbort) {
    let abortListener
    const abortPromise = new Promise((_, reject) => {
        abortListener = () => {
            onAbort?.()
            reject(signal.reason || new DOMException("PDF download aborted", "AbortError"))
        }
        if (signal.aborted) abortListener()
        else signal.addEventListener("abort", abortListener, { once: true })
    })
    return Promise.race([promise, abortPromise]).finally(() => {
        signal.removeEventListener("abort", abortListener)
    })
}

/**
 * Reads a PDF response while enforcing a byte limit and abort handling.
 * @param {Response} response Fetch response.
 * @param {AbortSignal} signal Request timeout/cancellation signal.
 * @returns {Promise<Buffer>} Validated-size PDF bytes.
 * @throws {RangeError} If the document exceeds MAX_PDF_BYTES.
 */
async function readPdfBuffer(response, signal) {
    const contentLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES) {
        throw new RangeError("Policy PDF exceeds the supported size")
    }

    if (!response.body) {
        const buffer = Buffer.from(await raceWithAbort(response.arrayBuffer(), signal))
        if (buffer.length > MAX_PDF_BYTES) throw new RangeError("Policy PDF exceeds the supported size")
        return buffer
    }

    const reader = response.body.getReader()
    return raceWithAbort((async () => {
        const chunks = []
        let totalBytes = 0
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            totalBytes += value.byteLength
            if (totalBytes > MAX_PDF_BYTES) {
                await reader.cancel()
                throw new RangeError("Policy PDF exceeds the supported size")
            }
            chunks.push(Buffer.from(value))
        }
        return Buffer.concat(chunks, totalBytes)
    })(), signal, () => {
        reader.cancel().catch(() => {})
    })
}

/**
 * Parses Gemini JSON and turns HTTP failures into status-bearing errors.
 * @param {Response} response Gemini fetch response.
 * @param {string} operation Human-readable operation name for diagnostics.
 * @returns {Promise<object>} Parsed Gemini result.
 * @throws {Error} When Gemini returns a non-success status.
 */
async function parseGeminiResponse(response, operation) {
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
        const error = new Error(result.error?.message || `${operation} failed (${response.status})`)
        error.status = response.status
        throw error
    }
    return result
}

/** @param {object} result Gemini generateContent response. @returns {string} Combined candidate text. */
function getGenerateContentReply(result) {
    return result.candidates?.[0]?.content?.parts
        ?.map(part => typeof part.text === "string" ? part.text : "")
        .join("")
        .trim() || ""
}

/** @param {Error & {status?: number}} error Gemini/network failure. @param {string} operation Operation label. @returns {{status:number,error:string}} Safe HTTP status and client-facing failure message. */
function getGeminiFailure(error, operation) {
    if (error.status === 429) {
        return {
            status: 503,
            error: `Gemini is rate-limiting ${operation}. Check the API project's quota and try again.`
        }
    }
    if (error.status === 401 || error.status === 403) {
        return {
            status: 503,
            error: `Gemini rejected the server credentials or access during ${operation} (HTTP ${error.status}): ${error.message}`
        }
    }
    if (error.status === 503) {
        return {
            status: 503,
            error: `Gemini is still experiencing high demand during ${operation} after ${GEMINI_503_RETRIES} retries: ${error.message}`
        }
    }
    if (error.name === "TimeoutError" || error.name === "AbortError") {
        return {
            status: 504,
            error: `Gemini timed out during ${operation}. Please try again.`
        }
    }
    if (Number.isInteger(error.status)) {
        return {
            status: 502,
            error: `Request failed during ${operation} (HTTP ${error.status}): ${error.message}`
        }
    }
    return {
        status: 502,
        error: `Could not complete ${operation}: ${error.message || "Unknown network error"}`
    }
}

/** @param {object} interaction Gemini interaction resource. @returns {string} Combined response text or empty string. */
function getInteractionReply(interaction) {
    if (typeof interaction.output_text === "string" && interaction.output_text.trim()) {
        return interaction.output_text.trim()
    }
    if (!Array.isArray(interaction.outputs)) return ""

    return interaction.outputs
        .map(output => {
            if (typeof output.text === "string") return output.text
            return output.content?.parts?.map(part => part.text || "").join("") || ""
        })
        .join("")
        .trim()
}

/**
 * Creates HTTP handlers for synchronous Gemini policy chat and interaction polling.
 * @param {object} options Policy model, API key, request dependencies, and timeout/retry configuration.
 * @returns {{create: import("express").RequestHandler, poll: import("express").RequestHandler}} Chat handlers.
 */
function createPolicyChatController({
    Policy,
    apiKey = process.env.GEMINI_API_KEY,
    fetchImpl = fetch,
    lookupImpl = lookup,
    timeoutMs = GEMINI_REQUEST_TIMEOUT_MS,
    pdfFetchTimeoutMs = PDF_FETCH_TIMEOUT_MS,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
    /**
     * Fetches a bounded PDF from its public HTTPS URL. AbortController limits network resource use.
     * @param {string} pdfUrl Policy document URL.
     * @returns {Promise<Buffer>} PDF bytes.
     * @throws {Error} For invalid/unavailable documents or fetch timeout.
     */
    async function fetchPdfBuffer(pdfUrl) {
        const { url: documentUrl, addresses } = await getPublicPdfUrl(pdfUrl, lookupImpl)

        const abortController = new AbortController()
        let timeout
        let onAbort
        const timeoutPromise = new Promise((_, reject) => {
            onAbort = () => reject(abortController.signal.reason
                || new DOMException("Policy PDF fetch timed out", "TimeoutError"))
            abortController.signal.addEventListener("abort", onAbort, { once: true })
            timeout = setTimeout(() => {
                abortController.abort(new DOMException("Policy PDF fetch timed out", "TimeoutError"))
            }, pdfFetchTimeoutMs)
        })

        try {
            return await Promise.race([
                (async () => {
                    const response = fetchImpl === fetch
                        ? await fetchPinnedPdf(documentUrl, addresses, abortController.signal)
                        : await fetchImpl(documentUrl, {
                            redirect: "error",
                            signal: abortController.signal
                        })
                    if (!response.ok) {
                        const error = new Error(`Policy document host returned HTTP ${response.status}`)
                        error.status = 502
                        throw error
                    }

                    const pdfBuffer = await readPdfBuffer(response, abortController.signal)
                    if (pdfBuffer.length < 5 || pdfBuffer.toString("ascii", 0, 5) !== "%PDF-") {
                        const error = new Error("The policy document is not a valid PDF")
                        error.status = 502
                        throw error
                    }
                    return pdfBuffer
                })(),
                timeoutPromise
            ])
        } finally {
            clearTimeout(timeout)
            abortController.signal.removeEventListener("abort", onAbort)
        }
    }

    /**
     * Retrieves policy context and requests a Gemini answer.
     * @route POST /api/policies/:id/chat
     * @param {import("express").Request} req Policy ObjectId in params and JSON {message} in body.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 {success, reply}; validation/provider/config/timeout errors use 400/413/502/503/504.
     */
    async function create(req, res) {
        let operation = "policy document fetch"
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ success: false, error: "A valid policy ID is required" })
            }

            const message = typeof req.body?.message === "string" ? req.body.message.trim() : ""
            if (!message || message.length > MAX_MESSAGE_LENGTH) {
                return res.status(400).json({
                    success: false,
                    error: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`
                })
            }
            if (!apiKey) {
                return res.status(503).json({ success: false, error: "Policy assistant is not configured" })
            }

            let policy
            try {
                policy = await Policy.findById(req.params.id).select("documentUrl pdfUrl")
            } catch (error) {
                console.error("Policy chat database lookup failed:", error.stack || error)
                return res.status(500).json({ success: false, error: "Unable to load this policy" })
            }
            if (!policy) {
                return res.status(404).json({ success: false, error: "Policy not found" })
            }

            // --- STEP 1: LOAD POLICY CONTEXT, BOUND PDF SIZE, AND PREPARE THE MODEL REQUEST ---
            const pdfBuffer = await fetchPdfBuffer(policy.documentUrl || policy.pdfUrl)
            const pdfBase64 = Buffer.from(pdfBuffer).toString("base64")
            operation = "Gemini policy chat request"
            const abortController = new AbortController()
            const timeout = setTimeout(() => {
                abortController.abort(new DOMException("Gemini request timed out", "TimeoutError"))
            }, timeoutMs)

            let result
            try {
                const url = `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`
                const options = {
                    method: "POST",
                    headers: {
                        "x-goog-api-key": apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: SYSTEM_INSTRUCTION }]
                        },
                        contents: [{
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: "application/pdf",
                                        data: pdfBase64
                                    }
                                },
                                { text: message }
                            ]
                        }]
                    }),
                    signal: abortController.signal
                }
                // Retry only transient Gemini 503 responses; the same abort deadline bounds all attempts.
                let response
                for (let attempt = 0; attempt <= GEMINI_503_RETRIES; attempt += 1) {
                    response = await fetchImpl(url, options)
                    if (response.status !== 503 || attempt === GEMINI_503_RETRIES) break
                    await response.body?.cancel()
                    await sleep(GEMINI_RETRY_DELAY_MS)
                }
                result = await parseGeminiResponse(response, "Gemini policy chat request")
            } finally {
                clearTimeout(timeout)
            }

            const reply = getGenerateContentReply(result)
            if (!reply) {
                console.error("Gemini returned no text for policy chat", JSON.stringify(result.promptFeedback || {}))
                return res.status(502).json({
                    success: false,
                    error: "The policy assistant returned no answer. Please try again."
                })
            }
            return res.status(200).json({
                success: true,
                reply
            })
        } catch (error) {
            console.error("Policy chat request failed:", error.stack || error)
            if (error instanceof RangeError) {
                return res.status(413).json({ success: false, error: error.message })
            }
            const failure = getGeminiFailure(
                error,
                operation
            )
            return res.status(failure.status).json({ success: false, error: failure.error })
        }
    }

    /**
     * Checks the status of an asynchronous Gemini interaction.
     * @route GET /api/policies/:id/chat/:interactionId
     * @param {import("express").Request} req Policy ID and Gemini interaction ID in route params.
     * @param {import("express").Response} res Express response.
     * @returns {Promise<import("express").Response>} 200 completed, 202 pending, or structured 400/502/503/504 errors.
     */
    async function poll(req, res) {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: "A valid policy ID is required" })
        }
        const interactionId = req.params.interactionId
        if (typeof interactionId !== "string"
            || interactionId.length > 256
            || !/^[A-Za-z0-9_-]+$/.test(interactionId)) {
            return res.status(400).json({ success: false, error: "A valid chat request ID is required" })
        }
        if (!apiKey) {
            return res.status(503).json({ success: false, error: "Policy assistant is not configured" })
        }

        const abortController = new AbortController()
        const timeout = setTimeout(() => {
            abortController.abort(new DOMException("Gemini status check timed out", "TimeoutError"))
        }, timeoutMs)
        try {
            const response = await fetchImpl(
                `${GEMINI_API_BASE}/v1beta/interactions/${encodeURIComponent(interactionId)}`,
                {
                    headers: { "x-goog-api-key": apiKey },
                    signal: abortController.signal
                }
            )
            const interaction = await parseGeminiResponse(response, "Gemini interaction status check")
            if (interaction.status === "completed") {
                const reply = getInteractionReply(interaction)
                if (!reply) {
                    return res.status(502).json({ success: false, error: "Policy assistant returned no answer" })
                }
                return res.status(200).json({ success: true, status: "completed", reply })
            }
            if (interaction.status === "failed" || interaction.status === "cancelled") {
                console.error("Gemini policy interaction ended:", interaction.status, interaction.error)
                return res.status(502).json({
                    success: false,
                    error: interaction.error?.message
                        ? `Policy assistant could not answer: ${interaction.error.message}`
                        : "Policy assistant could not answer right now"
                })
            }
            return res.status(202).json({
                success: true,
                status: interaction.status || "in_progress"
            })
        } catch (error) {
            console.error("Gemini policy interaction status check failed:", error)
            const failure = getGeminiFailure(error, "chat status check")
            return res.status(failure.status).json({ success: false, error: failure.error })
        } finally {
            clearTimeout(timeout)
        }
    }

    return { create, poll }
}

module.exports = {
    createPolicyChatController,
    SYSTEM_INSTRUCTION,
    MAX_MESSAGE_LENGTH,
    MAX_PDF_BYTES,
    PDF_FETCH_TIMEOUT_MS,
    GEMINI_REQUEST_TIMEOUT_MS,
    GEMINI_503_RETRIES,
    GEMINI_RETRY_DELAY_MS,
    GEMINI_MODEL,
    getGenerateContentReply,
    getInteractionReply
}
