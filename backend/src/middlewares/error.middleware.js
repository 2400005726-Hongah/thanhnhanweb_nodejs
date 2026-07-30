import env from '../config/env.js'

const normalizeError = (error) => {
  if (error.code === 'P2002') {
    const fields = Array.isArray(error.meta?.target)
      ? error.meta.target
      : []

    return {
      statusCode: 409,
      message: 'Dữ liệu đã tồn tại',
      errors: fields.map((field) => ({
        field,
        message: `${field} đã tồn tại`,
      })),
    }
  }

  if (error.code === 'P2025') {
    return {
      statusCode: 404,
      message: 'Không tìm thấy dữ liệu',
      errors: [],
    }
  }

  if (['P2003', 'P2014'].includes(error.code)) {
    return {
      statusCode: 409,
      message: 'Dữ liệu đang được tài nguyên khác sử dụng',
      errors: [],
    }
  }

  if (error.name === 'PrismaClientValidationError') {
    return {
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: [],
    }
  }

  if (error.code === 11000) {
    const duplicatedFields = Object.keys(error.keyValue || error.keyPattern || {})

    return {
      statusCode: 409,
      message: 'Dữ liệu đã tồn tại',
      errors: duplicatedFields.map((field) => ({
        field,
        message: `${field} đã tồn tại`,
      })),
    }
  }

  if (error.name === 'CastError') {
    return {
      statusCode: 400,
      message: `Giá trị ${error.path || 'đầu vào'} không hợp lệ`,
      errors: [
        {
          field: error.path || null,
          message: 'Giá trị không đúng định dạng',
        },
      ],
    }
  }

  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: Object.values(error.errors || {}).map((validationError) => ({
        field: validationError.path,
        message: validationError.message,
      })),
    }
  }

  return {
    statusCode: Number.isInteger(error.statusCode) ? error.statusCode : 500,
    message: error.message || 'Đã xảy ra lỗi trên máy chủ',
    errors: Array.isArray(error.errors) ? error.errors : [],
  }
}

const errorHandler = (error, _request, response, _next) => {
  const normalizedError = normalizeError(error)

  const message =
    env.nodeEnv === 'production' && normalizedError.statusCode === 500
      ? 'Đã xảy ra lỗi trên máy chủ'
      : normalizedError.message

  if (normalizedError.statusCode >= 500) {
    console.error(error)
  }

  response.status(normalizedError.statusCode).json({
    success: false,
    message,
    errors: normalizedError.errors,
  })
}

export default errorHandler
