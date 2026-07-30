import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.JWT_EXPIRES_IN = '1h'
process.env.BCRYPT_SALT_ROUNDS = '10'

const users = []

const findUser = (where) => {
  if (where.id) return users.find((user) => user.id === where.id)
  if (where.email) return users.find((user) => user.email === where.email)
  if (where.phone) return users.find((user) => user.phone === where.phone)
  return null
}

const prisma = {
  user: {
    findMany: jest.fn(async ({ where }) =>
      users.filter((user) =>
        where.OR.some((condition) =>
          Object.entries(condition).every(([key, value]) => user[key] === value),
        ),
      )),
    findUnique: jest.fn(async ({ where }) => findUser(where) || null),
    create: jest.fn(async ({ data }) => {
      const now = new Date()
      const user = {
        id: randomUUID(),
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        ...data,
      }
      users.push(user)
      return user
    }),
    update: jest.fn(async ({ where, data }) => {
      const user = findUser(where)
      Object.assign(user, data, { updatedAt: new Date() })
      return user
    }),
  },
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { default: app } = await import('../src/app.js')
const { authorizeRoles } = await import('../src/middlewares/auth.middleware.js')

const validRegistration = {
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  phone: '0987654321',
  password: 'MatKhau123',
  confirmPassword: 'MatKhau123',
}

const registerUser = (overrides = {}) =>
  request(app)
    .post('/api/v1/auth/register')
    .send({ ...validRegistration, ...overrides })

beforeEach(() => {
  users.length = 0
  jest.clearAllMocks()
})

describe('Authentication API with Prisma', () => {
  test('registers CUSTOMER, hashes password and returns a UUID JWT', async () => {
    const response = await registerUser()

    expect(response.statusCode).toBe(201)
    expect(response.body.data.user.role).toBe('CUSTOMER')
    expect(response.body.data.user.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(response.body.data.user).not.toHaveProperty('passwordHash')
    expect(await bcrypt.compare('MatKhau123', users[0].passwordHash)).toBe(true)

    const payload = jwt.verify(response.body.data.token, process.env.JWT_SECRET)
    expect(payload.userId).toBe(users[0].id)
  })

  test('rejects missing registration data', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'an@example.com' })
    expect(response.statusCode).toBe(400)
  })

  test('rejects duplicate email', async () => {
    await registerUser()
    const response = await registerUser({ phone: '0977777777' })
    expect(response.statusCode).toBe(409)
    expect(response.body.errors[0].field).toBe('email')
  })

  test('rejects duplicate phone', async () => {
    await registerUser()
    const response = await registerUser({ email: 'other@example.com' })
    expect(response.statusCode).toBe(409)
    expect(response.body.errors[0].field).toBe('phone')
  })

  test('does not let clients register ADMIN', async () => {
    const response = await registerUser({ role: 'ADMIN' })
    expect(response.statusCode).toBe(400)
    expect(users).toHaveLength(0)
  })

  test('does not let clients register STAFF', async () => {
    const response = await registerUser({ role: 'STAFF' })
    expect(response.statusCode).toBe(400)
    expect(users).toHaveLength(0)
  })

  test('logs in by email and updates lastLoginAt', async () => {
    await registerUser()
    const response = await request(app).post('/api/v1/auth/login').send({
      identifier: 'AN@EXAMPLE.COM',
      password: 'MatKhau123',
    })
    expect(response.statusCode).toBe(200)
    expect(users[0].lastLoginAt).toBeInstanceOf(Date)
  })

  test('logs in by phone', async () => {
    await registerUser()
    const response = await request(app).post('/api/v1/auth/login').send({
      identifier: '+84987654321',
      password: 'MatKhau123',
    })
    expect(response.statusCode).toBe(200)
    expect(response.body.data.user.phone).toBe('0987654321')
  })

  test('rejects a wrong password', async () => {
    await registerUser()
    const response = await request(app).post('/api/v1/auth/login').send({
      identifier: 'an@example.com',
      password: 'SaiMatKhau123',
    })
    expect(response.statusCode).toBe(401)
  })

  test('rejects an inactive account', async () => {
    users.push({
      id: randomUUID(),
      fullName: 'Inactive User',
      email: 'inactive@example.com',
      phone: '0966666666',
      passwordHash: await bcrypt.hash('MatKhau123', 10),
      role: 'CUSTOMER',
      status: 'INACTIVE',
    })
    const response = await request(app).post('/api/v1/auth/login').send({
      identifier: 'inactive@example.com',
      password: 'MatKhau123',
    })
    expect(response.statusCode).toBe(403)
  })

  test('requires a token for GET /auth/me', async () => {
    const response = await request(app).get('/api/v1/auth/me')
    expect(response.statusCode).toBe(401)
  })

  test('rejects an invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')
    expect(response.statusCode).toBe(401)
  })

  test('returns current user without passwordHash', async () => {
    const registration = await registerUser()
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.token}`)
    expect(response.statusCode).toBe(200)
    expect(response.body.data.user.email).toBe('an@example.com')
    expect(response.body.data.user).not.toHaveProperty('passwordHash')
  })

  test('rejects a wrong current password', async () => {
    const registration = await registerUser()
    const response = await request(app)
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${registration.body.data.token}`)
      .send({
        currentPassword: 'SaiMatKhau123',
        newPassword: 'MatKhau456',
        confirmNewPassword: 'MatKhau456',
      })
    expect(response.statusCode).toBe(400)
  })

  test('changes password without returning its hash', async () => {
    const registration = await registerUser()
    const response = await request(app)
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${registration.body.data.token}`)
      .send({
        currentPassword: 'MatKhau123',
        newPassword: 'MatKhau456',
        confirmNewPassword: 'MatKhau456',
      })
    expect(response.statusCode).toBe(200)
    expect(await bcrypt.compare('MatKhau456', users[0].passwordHash)).toBe(true)
    expect(response.body).not.toHaveProperty('passwordHash')
  })

  test('authorizeRoles rejects CUSTOMER on ADMIN routes', () => {
    const next = jest.fn()
    authorizeRoles('ADMIN')({ user: { role: 'CUSTOMER' } }, {}, next)
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 })
  })
})
