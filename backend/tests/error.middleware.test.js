import errorHandler from '../src/middlewares/error.middleware.js'

const createResponse = () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }

  return response
}

describe('Error middleware', () => {
  test('chuyển Prisma unique constraint thành HTTP 409', () => {
    const response = createResponse()

    errorHandler(
      {
        code: 'P2002',
        meta: { target: ['email'] },
      },
      null,
      response,
      () => {},
    )

    expect(response.statusCode).toBe(409)
    expect(response.body).toEqual({
      success: false,
      message: 'Dữ liệu đã tồn tại',
      errors: [{ field: 'email', message: 'email đã tồn tại' }],
    })
  })

  test('chuyển Prisma validation error thành HTTP 400', () => {
    const response = createResponse()

    errorHandler(
      { name: 'PrismaClientValidationError' },
      null,
      response,
      () => {},
    )

    expect(response.statusCode).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('Dữ liệu không hợp lệ')
  })
})
