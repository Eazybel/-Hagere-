const mongoose = require("mongoose")

const SYSTEM_INSTRUCTION = "You are an expert AI civic assistant for Hagere. Read the attached policy document carefully, and answer the user's question accurately in Amharic (አማርኛ). If the answer is not in the document, politely state that it is not covered in this policy."
const MAX_MESSAGE_LENGTH = 4000
const MAX_PDF_BYTES = 14 * 1024 * 1024
const GEMINI_FILE_CACHE_MS = 47 * 60 * 60 * 1000
const GEMINI_FILE_CACHE_LIMIT = 100
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com"
const GEMINI_MODEL = "gemini-3.8-flash"

function getCloudinaryUrl(pdfUrl) {
    let url
    try {
        url = new URL(pdfUrl)
    } catch {
        return null
    }

    if (url.hostname !== "res.cloudinary.com"
        || !["http:", "https:"].includes(url.protocol)
        || url.username
        || url.password
        || (url.port && url.port !== "80" && url.port !== "443")) {
        return null
    }
    url.protocol = "https:"
    url.port = ""
    return url
}

async function readPdfBuffer(response) {
    const contentLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES) {
        throw new RangeError("Policy PDF exceeds the supported size")
    }

    if (!response.body) {
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > MAX_PDF_BYTES) throw new RangeError("Policy PDF exceeds the supported size")
        return buffer
    }

    const reader = response.body.getReader()
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
}

async function parseGeminiResponse(response, operation) {
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
        const error = new Error(result.error?.message || `${operation} failed (${response.status})`)
        error.status = response.status
        throw error
    }
    return result
}

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

function createPolicyChatController({
    Policy,
    apiKey,
    fetchImpl = fetch,
    timeoutSignal = milliseconds => AbortSignal.timeout(milliseconds)
}) {
    const fileCache = new Map()
    const pendingFileUploads = new Map()

    async function uploadPolicyPdf(pdfUrl, policyId) {
        const cached = fileCache.get(pdfUrl)
        if (cached && cached.expiresAt > Date.now()) return cached
        if (cached) fileCache.delete(pdfUrl)

        const pending = pendingFileUploads.get(pdfUrl)
        if (pending) return pending

        const upload = (async () => {
            const cloudinaryUrl = getCloudinaryUrl(pdfUrl)
            if (!cloudinaryUrl) {
                const error = new Error("Policy document URL is invalid")
                error.status = 502
                throw error
            }

            const pdfResponse = await fetchImpl(cloudinaryUrl, {
                redirect: "error",
                signal: timeoutSignal(30000)
            })
            if (!pdfResponse.ok) {
                const error = new Error("Unable to retrieve the policy document")
                error.status = 502
                throw error
            }

            const pdfBuffer = await readPdfBuffer(pdfResponse)
            if (pdfBuffer.length < 5 || pdfBuffer.toString("ascii", 0, 5) !== "%PDF-") {
                const error = new Error("The policy document is not a valid PDF")
                error.status = 502
                throw error
            }

            const startResponse = await fetchImpl(`${GEMINI_API_BASE}/upload/v1beta/files`, {
                method: "POST",
                headers: {
                    "x-goog-api-key": apiKey,
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": String(pdfBuffer.length),
                    "X-Goog-Upload-Header-Content-Type": "application/pdf",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file: { display_name: `hagere-policy-${policyId}` }
                }),
                signal: timeoutSignal(30000)
            })
            if (!startResponse.ok) {
                await parseGeminiResponse(startResponse, "Gemini file upload initialization")
            }

            const uploadUrlValue = startResponse.headers.get("x-goog-upload-url")
            let uploadUrl
            try {
                uploadUrl = new URL(uploadUrlValue)
            } catch {
                throw new Error("Gemini did not return a valid file upload URL")
            }
            if (uploadUrl.protocol !== "https:"
                || !(uploadUrl.hostname === "googleapis.com" || uploadUrl.hostname.endsWith(".googleapis.com"))
                || uploadUrl.username
                || uploadUrl.password) {
                throw new Error("Gemini returned an untrusted file upload URL")
            }

            const finalizeResponse = await fetchImpl(uploadUrl, {
                method: "POST",
                headers: {
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize",
                    "Content-Type": "application/pdf"
                },
                body: pdfBuffer,
                signal: timeoutSignal(60000)
            })
            const uploadedFile = await parseGeminiResponse(finalizeResponse, "Gemini PDF upload")
            const fileUri = uploadedFile.file?.uri
            const fileName = uploadedFile.file?.name
            if (typeof fileUri !== "string" || typeof fileName !== "string") {
                throw new Error("Gemini did not return a valid uploaded file")
            }

            const cachedFile = {
                uri: fileUri,
                name: fileName,
                expiresAt: Date.now() + GEMINI_FILE_CACHE_MS
            }
            fileCache.set(pdfUrl, cachedFile)
            while (fileCache.size > GEMINI_FILE_CACHE_LIMIT) {
                fileCache.delete(fileCache.keys().next().value)
            }
            return cachedFile
        })()

        pendingFileUploads.set(pdfUrl, upload)
        try {
            return await upload
        } finally {
            pendingFileUploads.delete(pdfUrl)
        }
    }

    async function create(req, res) {
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
            policy = await Policy.findById(req.params.id).select("pdfUrl")
        } catch (error) {
            console.error("Policy chat database lookup failed:", error)
            return res.status(500).json({ success: false, error: "Unable to load this policy" })
        }
        if (!policy) {
            return res.status(404).json({ success: false, error: "Policy not found" })
        }

        let file
        try {
            file = await uploadPolicyPdf(policy.pdfUrl, req.params.id)
        } catch (error) {
            console.error("Policy document preparation failed:", error)
            if (error instanceof RangeError) {
                return res.status(413).json({ success: false, error: error.message })
            }
            const failure = getGeminiFailure(error, "policy document preparation")
            return res.status(failure.status).json({ success: false, error: failure.error })
        }

        try {
            const response = await fetchImpl(`${GEMINI_API_BASE}/v1beta/interactions`, {
                method: "POST",
                headers: {
                    "x-goog-api-key": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: GEMINI_MODEL,
                    background: true,
                    system_instruction: SYSTEM_INSTRUCTION,
                    input: [
                        { type: "document", uri: file.uri, mime_type: "application/pdf" },
                        { type: "text", text: message }
                    ]
                }),
                signal: timeoutSignal(30000)
            })
            const interaction = await parseGeminiResponse(response, "Gemini interaction creation")
            if (typeof interaction.id !== "string" || !interaction.id) {
                console.error("Gemini interaction response did not contain an ID")
                return res.status(502).json({ success: false, error: "Policy assistant could not start a response" })
            }
            if (interaction.status === "completed") {
                const reply = getInteractionReply(interaction)
                if (reply) return res.status(200).json({ success: true, reply })
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
                status: interaction.status || "in_progress",
                interactionId: interaction.id
            })
        } catch (error) {
            console.error("Gemini policy interaction could not be started:", error)
            const failure = getGeminiFailure(error, "policy chat request")
            return res.status(failure.status).json({ success: false, error: failure.error })
        }
    }

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

        try {
            const response = await fetchImpl(
                `${GEMINI_API_BASE}/v1beta/interactions/${encodeURIComponent(interactionId)}`,
                {
                    headers: { "x-goog-api-key": apiKey },
                    signal: timeoutSignal(15000)
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
        }
    }

    return { create, poll }
}

module.exports = {
    createPolicyChatController,
    SYSTEM_INSTRUCTION,
    MAX_MESSAGE_LENGTH,
    MAX_PDF_BYTES,
    GEMINI_FILE_CACHE_MS,
    GEMINI_FILE_CACHE_LIMIT,
    GEMINI_MODEL,
    getInteractionReply
}
