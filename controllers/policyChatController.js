/**
 * @file policyChatController.js
 * @description Retrieves bounded PDF content from public HTTP(S) URLs and sends policy-grounded questions to Gemini with timeout/retry handling.
 * @module Controllers/PolicyChat
 * @requires mongoose and the shared PDF fetcher
 */
const mongoose = require("mongoose")
const { fetchPdfBuffer, PDF_FETCH_TIMEOUT_MS, MAX_PDF_BYTES } = require("../utils/pdfFetcher")

const SYSTEM_INSTRUCTION = "You are an expert AI civic assistant for Hagere. Read the attached policy document carefully, and answer the user's question accurately and thoroughly in Amharic (አማርኛ)."
const MAX_MESSAGE_LENGTH = 4000
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com"
const GEMINI_MODEL = "gemini-3.1-flash-lite"
const GEMINI_REQUEST_TIMEOUT_MS = 90_000
const GEMINI_503_RETRIES = 2
const GEMINI_RETRY_DELAY_MS = 2000

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
    pdfFetcher = fetchPdfBuffer,
    timeoutMs = GEMINI_REQUEST_TIMEOUT_MS,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
}) {
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
            const pdfBuffer = await pdfFetcher(policy.documentUrl || policy.pdfUrl)
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
