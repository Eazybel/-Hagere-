const mongoose = require("mongoose")

const SYSTEM_INSTRUCTION = "You are an expert AI civic assistant for Hagere. Read the attached policy document carefully, and answer the user's question accurately in Amharic (አማርኛ). If the answer is not in the document, politely state that it is not covered in this policy."
const MAX_MESSAGE_LENGTH = 4000
const MAX_PDF_BYTES = 14 * 1024 * 1024
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

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

function createPolicyChatController({ Policy, apiKey, fetchImpl = fetch }) {
    return async (req, res) => {
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

        const documentUrl = getCloudinaryUrl(policy.pdfUrl)
        if (!documentUrl) {
            return res.status(502).json({ success: false, error: "Policy document URL is invalid" })
        }

        let pdfBuffer
        try {
            const pdfResponse = await fetchImpl(documentUrl, {
                redirect: "error",
                signal: AbortSignal.timeout(30000)
            })
            if (!pdfResponse.ok) {
                return res.status(502).json({ success: false, error: "Unable to retrieve the policy document" })
            }
            pdfBuffer = await readPdfBuffer(pdfResponse)
            if (pdfBuffer.length < 5 || pdfBuffer.toString("ascii", 0, 5) !== "%PDF-") {
                return res.status(502).json({ success: false, error: "The policy document is not a valid PDF" })
            }
        } catch (error) {
            if (error instanceof RangeError) {
                return res.status(413).json({ success: false, error: "Policy PDF exceeds the supported 14 MB size" })
            }
            console.error("Policy PDF retrieval failed:", error)
            return res.status(502).json({ success: false, error: "Unable to retrieve the policy document" })
        }

        try {
            const geminiResponse = await fetchImpl(GEMINI_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }]
                    },
                    contents: [{
                        role: "user",
                        parts: [
                            { text: message },
                            {
                                inlineData: {
                                    mimeType: "application/pdf",
                                    data: pdfBuffer.toString("base64")
                                }
                            }
                        ]
                    }]
                }),
                signal: AbortSignal.timeout(60000)
            })
            const result = await geminiResponse.json().catch(() => ({}))
            if (!geminiResponse.ok) {
                console.error("Gemini policy chat request failed:", geminiResponse.status, result.error?.message)
                return res.status(502).json({ success: false, error: "Policy assistant could not answer right now" })
            }

            const reply = result.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim()
            if (!reply) {
                return res.status(502).json({ success: false, error: "Policy assistant returned no answer" })
            }
            return res.status(200).json({ success: true, reply })
        } catch (error) {
            console.error("Gemini policy chat request failed:", error)
            return res.status(502).json({ success: false, error: "Policy assistant could not answer right now" })
        }
    }
}

module.exports = {
    createPolicyChatController,
    SYSTEM_INSTRUCTION,
    MAX_MESSAGE_LENGTH,
    MAX_PDF_BYTES
}
