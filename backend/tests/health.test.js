import { jest } from '@jest/globals'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

jest.unstable_mockModule('../src/config/prisma.js', () => ({
  default: {},
}))

const { default: app } = await import('../src/app.js')

describe('Health API', () => {
  test('GET /api/v1/health trả về trạng thái hoạt động', async () => {
    const response = await request(app).get('/api/v1/health')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      success: true,
      message: 'NHÀ XE THÀNH NHÂN API đang hoạt động',
      data: {
        status: 'OK',
        timestamp: expect.any(String),
      },
    })
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false)
  })

  test('Route không tồn tại trả về lỗi 404 đúng định dạng', async () => {
    const response = await request(app).get('/api/v1/khong-ton-tai')

    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({
      success: false,
      message: 'Không tìm thấy route GET /api/v1/khong-ton-tai',
      errors: [],
    })
  })

  test.each([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
  ])('Cho phép frontend local gọi API từ %s', async (origin) => {
    const response = await request(app)
      .options('/api/v1/public/locations')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(origin)
  })
})
