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
let existingLocation = null

const users = new Map([
  [adminId, { id: adminId, role: 'ADMIN', status: 'ACTIVE' }],
  [customerId, { id: customerId, role: 'CUSTOMER', status: 'ACTIVE' }],
])

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }) => users.get(where.id) || null),
  },
  location: {
    findFirst: jest.fn(async () => existingLocation),
    create: jest.fn(async ({ data }) => ({ id: locationId, ...data })),
  },
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { default: app } = await import('../src/app.js')

const tokenFor = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' })

const adminToken = tokenFor(adminId, 'ADMIN')
const customerToken = tokenFor(customerId, 'CUSTOMER')

beforeEach(() => {
  existingLocation = null
  jest.clearAllMocks()
})

describe('Prisma management authorization and Location API', () => {
  test('CUSTOMER cannot create a location', async () => {
    const response = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Krong Nang', province: 'Dak Lak' })

    expect(response.statusCode).toBe(403)
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  test('ADMIN creates a location', async () => {
    const response = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  Krong   Nang  ', province: 'Dak Lak' })

    expect(response.statusCode).toBe(201)
    expect(response.body.data.location.name).toBe('Krông Năng')
    expect(prisma.location.create).toHaveBeenCalledTimes(1)
  })

  test('does not create a duplicate location', async () => {
    existingLocation = { id: locationId }
    const response = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Krong Nang', province: 'Dak Lak' })

    expect(response.statusCode).toBe(409)
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  test('CUSTOMER cannot update or delete management data', async () => {
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
