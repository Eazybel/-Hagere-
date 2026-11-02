/**
 * @file pdfFetcher.js
 * @description Downloads bounded PDF files from public HTTP or HTTPS URLs.
 * @module Utils/PdfFetcher
 * @requires axios and Node.js DNS, HTTP, HTTPS, and network APIs
 */
const axios = require("axios")
const http = require("node:http")
const https = require("node:https")
const { lookup } = require("node:dns/promises")
const { isIP } = require("node:net")

const PDF_FETCH_TIMEOUT_MS = 15_000
const MAX_PDF_BYTES = 14 * 1024 * 1024

/**
 * Determines whether an IP address is globally routable.
 * @param {string} address IP address to validate.
 * @returns {boolean} Whether the address is public.
 */
function isPublicIp(address) {
    const family = isIP(address)
    if (family === 4) {
        const value = address.split(".").map(Number)
            .reduce((result, octet) => result * 256 + octet, 0)
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
 * Resolves a document URL and rejects non-public or credential-bearing destinations.
 * @param {string} value Candidate PDF URL.
 * @param {Function} lookupImpl DNS lookup implementation.
 * @returns {Promise<{url: URL, addresses: object[]}>} Validated URL and pinned DNS results.
 * @throws {Error} If the URL is invalid, unsupported, or resolves to a non-public IP.
 */
async function validatePdfUrl(value, lookupImpl) {
    let url
    try {
        url = new URL(value)
    } catch {
        throw new Error("Policy document URL is invalid")
    }

    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Policy document URL must use HTTP or HTTPS without embedded credentials")
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

/**
 * Pins HTTP agent DNS resolution to the already-validated public addresses.
 * @param {object[]} addresses DNS lookup results.
 * @returns {Function} Node-compatible lookup callback.
 */
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

/**
 * Creates a dependency-injectable PDF fetcher.
 * TLS certificate verification remains enabled; configure trusted CAs via
 * NODE_EXTRA_CA_CERTS rather than disabling certificate validation.
 * @param {object} [options] Optional Axios client, DNS lookup, and timeout overrides.
 * @param {object} [options.axiosClient] Axios-compatible client.
 * @param {Function} [options.lookupImpl] DNS lookup implementation.
 * @param {number} [options.timeoutMs] Request timeout in milliseconds.
 * @returns {Function} Function that fetches and validates PDF data.
 */
function createPdfFetcher({
    axiosClient = axios,
    lookupImpl = lookup,
    timeoutMs = PDF_FETCH_TIMEOUT_MS
} = {}) {
    /**
     * Downloads a PDF from a public HTTP or HTTPS URL.
     * Redirects are rejected so a validated public URL cannot redirect to a private host.
     * @param {string} url Public document URL.
     * @returns {Promise<Buffer>} Downloaded PDF bytes.
     * @throws {Error|RangeError} If the URL, request, size, or PDF content is invalid.
     */
    return async function fetchPdfBuffer(url) {
        const { url: documentUrl, addresses } = await validatePdfUrl(url, lookupImpl)
        const pinnedLookup = createPinnedLookup(addresses)
        const httpAgent = new http.Agent({ keepAlive: false, lookup: pinnedLookup })
        const httpsAgent = new https.Agent({
            keepAlive: false,
            lookup: pinnedLookup,
            rejectUnauthorized: true
        })

        try {
            const response = await axiosClient.get(documentUrl.href, {
                responseType: "arraybuffer",
                httpAgent,
                httpsAgent,
                timeout: timeoutMs,
                maxContentLength: MAX_PDF_BYTES,
                maxBodyLength: MAX_PDF_BYTES,
                maxRedirects: 0,
                proxy: false,
                validateStatus: status => status >= 200 && status < 300
            })
            const buffer = Buffer.from(response.data)
            if (buffer.length > MAX_PDF_BYTES) {
                throw new RangeError("Policy PDF exceeds the supported size")
            }
            if (buffer.length < 5 || buffer.toString("ascii", 0, 5) !== "%PDF-") {
                throw new Error("The policy document is not a valid PDF")
            }
            return buffer
        } catch (error) {
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                throw new DOMException("Policy PDF fetch timed out", "TimeoutError")
            }
            if (error.code === "ERR_BAD_RESPONSE" && /maxContentLength/i.test(error.message)) {
                throw new RangeError("Policy PDF exceeds the supported size")
            }
            throw error
        } finally {
            httpAgent.destroy()
            httpsAgent.destroy()
        }
    }
}

const fetchPdfBuffer = createPdfFetcher()

module.exports = {
    fetchPdfBuffer,
    createPdfFetcher,
    PDF_FETCH_TIMEOUT_MS,
    MAX_PDF_BYTES
}
