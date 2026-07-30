class HttpError extends Error {
  constructor(message, statusCode = 500, errors = []) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.errors = errors
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

export default HttpError

