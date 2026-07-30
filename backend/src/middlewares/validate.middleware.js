import { validationResult } from 'express-validator'

import HttpError from '../utils/HttpError.js'

const validate = (request, _response, next) => {
  const result = validationResult(request)

  if (result.isEmpty()) {
    next()
    return
  }

  const errors = result.array({ onlyFirstError: true }).map((error) => ({
    field: error.path,
    message: error.msg,
  }))

  next(new HttpError('Dữ liệu không hợp lệ', 400, errors))
}

export default validate

