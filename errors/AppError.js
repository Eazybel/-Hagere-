class AppError extends Error {
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
