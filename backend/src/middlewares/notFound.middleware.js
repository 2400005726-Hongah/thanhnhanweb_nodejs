import HttpError from '../utils/HttpError.js'

const notFoundHandler = (request, _response, next) => {
  next(
    new HttpError(
      `Không tìm thấy route ${request.method} ${request.originalUrl}`,
      404,
    ),
  )
}

export default notFoundHandler

