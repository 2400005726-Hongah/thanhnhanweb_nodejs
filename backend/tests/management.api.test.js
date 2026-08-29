import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.JWT_EXPIRES_IN = '1h'

const adminId = randomUUID()
const customerId = randomUUID()
const locationId = randomUUID()

const users = new Map([
  [adminId, { id: adminId, role: 'ADMIN', status: 'ACTIVE' }],
  [customerId, { id: customerId, role: 'CUSTOMER', status: 'ACTIVE' }],
])

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }) => users.get(where.id) || null),
  },
  location: {
    create: jest.fn(),
    update: jest.fn(),
  },
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { default: app } = await import('../src/app.js')

const tokenFor = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' })

const adminToken = tokenFor(adminId, 'ADMIN')
const customerToken = tokenFor(customerId, 'CUSTOMER')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Location API sau khi chuyển sang kiến trúc danh mục mới', () => {
  test('CUSTOMER không được ghi dữ liệu qua API địa điểm legacy', async () => {
    const response = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Krong Nang', province: 'Dak Lak' })

    expect(response.statusCode).toBe(403)
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  test('ADMIN cũng không thể tạo địa điểm bằng API legacy thiếu tỉnh + bộ lọc chuẩn', async () => {
    const response = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Krong Nang', province: 'Dak Lak' })

    expect(response.statusCode).toBe(410)
    expect(response.body.message).toContain('/locations/specific')
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  test('API sửa và xóa địa điểm legacy cũng bị khóa đối với ADMIN', async () => {
    const [updateResponse, deleteResponse] = await Promise.all([
      request(app)
        .patch(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated location' }),
      request(app)
        .delete(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${adminToken}`),
    ])

    expect(updateResponse.statusCode).toBe(410)
    expect(deleteResponse.statusCode).toBe(410)
    expect(prisma.location.update).not.toHaveBeenCalled()
  })

  test('CUSTOMER không thể sửa hoặc xóa dữ liệu quản trị', async () => {
    const [updateResponse, deleteResponse] = await Promise.all([
      request(app)
        .patch(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Updated location' }),
      request(app)
        .delete(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${customerToken}`),
    ])

    expect(updateResponse.statusCode).toBe(403)
    expect(deleteResponse.statusCode).toBe(403)
  })
})
