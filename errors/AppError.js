/**
 * @file AppError.js
 * @description Defines an operational HTTP error carrying a validated status code for Express error handling.
 * @module Errors/AppError
 * @requires Node.js Error
 */
/**
 * Error type for expected application failures with an HTTP status.
 * @extends Error
 */
class AppError extends Error {
    /**
     * @param {string} message Safe message suitable for an API response.
     * @param {number} [statusCode=500] HTTP error status (400-599).
     * @throws {RangeError} If statusCode is not an integer HTTP error status.
     */
    constructor(message, statusCode = 500) {
        super(message)

        if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
            throw new RangeError("AppError statusCode must be an HTTP error status")
        }

        this.name = "AppError"
        this.statusCode = statusCode
        this.isOperational = true
        Error.captureStackTrace?.(this, AppError)
    }
}

module.exports = AppError
