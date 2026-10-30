const AppError = require("../errors/AppError")

function notFoundHandler(req, res, next) {
    next(new AppError("Route not found", 404))
}

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
