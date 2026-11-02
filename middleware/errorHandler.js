/**
 * @file errorHandler.js
 * @description Converts unmatched routes and thrown request errors into consistent JSON HTTP responses.
 * @module Middleware/Errors
 * @requires internal AppError type
 */
const AppError = require("../errors/AppError")

/**
 * Forwards an explicit 404 error for unmatched routes.
 * @param {import("express").Request} req Unmatched request.
 * @param {import("express").Response} res Express response.
 * @param {import("express").NextFunction} next Express error middleware.
 * @returns {void} Calls next with an AppError(404).
 */
function notFoundHandler(req, res, next) {
    next(new AppError("Route not found", 404))
}

/**
 * Serializes known application errors and malformed JSON errors as safe JSON responses.
 * @param {Error} error Error supplied by Express.
 * @param {import("express").Request} req Request that failed.
 * @param {import("express").Response} res Response to write.
 * @param {import("express").NextFunction} next Pass-through when headers have already been sent.
 * @returns {import("express").Response|void} JSON {success:false,message}, or forwards the error.
 */
function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error)
    }

    const isAppError = error instanceof AppError
    const isInvalidJson = error?.type === "entity.parse.failed"
    const statusCode = isAppError ? error.statusCode : isInvalidJson ? 400 : 500
    const message = isAppError
        ? error.message
        : isInvalidJson
            ? "Invalid JSON request body"
            : "Internal server error"

    if (statusCode >= 500) {
        console.error(error)
    }

    return res.status(statusCode).json({
        success: false,
        message
    })
}

module.exports = { notFoundHandler, errorHandler }
