import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.SEAT_HOLD_MINUTES = '10'

const tripId = randomUUID()
const tripSeatIds = [randomUUID(), randomUUID()]
const userId = randomUUID()
const holdToken = 'a'.repeat(64)
const holdSeats = jest.fn(async () => ({
  holdToken,
  holdExpiresAt: new Date('2099-07-25T12:10:00.000Z'),
  seats: [],
  totalAmount: 600000,
}))
const releaseSeatHold = jest.fn(async () => ({ releasedSeatCount: 2 }))
const createBooking = jest.fn(async () => ({
  booking: { bookingCode: 'TNTESTBOOKING', status: 'PENDING' },
}))
const prisma = {
  user: {
    findUnique: jest.fn(async () => ({
      id: userId,
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
      phone: '0987654321',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    })),
  },
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))
jest.unstable_mockModule('../src/services/booking.service.js', () => ({
  createBooking,
  holdSeats,
  releaseSeatHold,
}))

const { default: app } = await import('../src/app.js')

const passenger = {
  fullName: 'Nguyễn Văn A',
  phone: '0987654321',
  email: 'a@example.com',
}

beforeEach(() => jest.clearAllMocks())

describe('Seat hold and booking API validation', () => {
  test('holds selected seats for a guest', async () => {
    const response = await request(app)
      .post(`/api/v1/public/trips/${tripId}/seats/hold`)
      .send({ tripSeatIds })

    expect(response.statusCode).toBe(201)
    expect(response.body.data.holdToken).toBe(holdToken)
    expect(holdSeats).toHaveBeenCalledWith(tripId, tripSeatIds)
  })

  test.each([
    ['empty array', []],
    ['invalid UUID', ['invalid-id']],
    ['duplicated IDs', [tripSeatIds[0], tripSeatIds[0]]],
    ['more than six seats', Array.from({ length: 7 }, () => randomUUID())],
  ])('rejects %s when holding seats', async (_label, seatIds) => {
    const response = await request(app)
      .post(`/api/v1/public/trips/${tripId}/seats/hold`)
      .send({ tripSeatIds: seatIds })

    expect(response.statusCode).toBe(400)
    expect(holdSeats).not.toHaveBeenCalled()
  })

  test('does not accept totalAmount from the hold request', async () => {
    const response = await request(app)
      .post(`/api/v1/public/trips/${tripId}/seats/hold`)
      .send({ tripSeatIds, totalAmount: 1 })

    expect(response.statusCode).toBe(400)
  })

  test('releases seats using a valid hold token', async () => {
    const response = await request(app)
      .delete(`/api/v1/public/trips/${tripId}/seats/hold`)
      .send({ holdToken })

    expect(response.statusCode).toBe(200)
    expect(releaseSeatHold).toHaveBeenCalledWith(tripId, holdToken)
  })

  test('creates a guest booking with validated passenger data', async () => {
    const payload = {
      tripId,
      holdToken,
      passenger,
      customerNote: 'Đón tại cổng chính',
    }
    const response = await request(app)
      .post('/api/v1/public/bookings')
      .send(payload)

    expect(response.statusCode).toBe(201)
    expect(createBooking).toHaveBeenCalledWith(payload, undefined)
  })

  test('attaches an active user when a valid JWT is supplied', async () => {
    const token = jwt.sign(
      { userId, role: 'CUSTOMER' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    )
    const payload = { tripId, holdToken, passenger }
    const response = await request(app)
      .post('/api/v1/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)

    expect(response.statusCode).toBe(201)
    expect(createBooking).toHaveBeenCalledWith(payload, userId)
  })

  test.each([
    ['invalid phone', { ...passenger, phone: '123' }],
    ['invalid email', { ...passenger, email: 'invalid' }],
    ['missing full name', { phone: passenger.phone }],
  ])('rejects %s in passenger data', async (_label, invalidPassenger) => {
    const response = await request(app)
      .post('/api/v1/public/bookings')
      .send({ tripId, holdToken, passenger: invalidPassenger })

    expect(response.statusCode).toBe(400)
    expect(createBooking).not.toHaveBeenCalled()
  })

  test('rejects server-owned booking fields from the client', async () => {
    const response = await request(app)
      .post('/api/v1/public/bookings')
      .send({ tripId, holdToken, passenger, totalAmount: 1, status: 'CONFIRMED' })

    expect(response.statusCode).toBe(400)
    expect(createBooking).not.toHaveBeenCalled()
  })

  test('does not allow a public client to choose HOTLINE or COUNTER source', async () => {
    const response = await request(app)
      .post('/api/v1/public/bookings')
      .send({ tripId, holdToken, passenger, source: 'HOTLINE' })

    expect(response.statusCode).toBe(400)
    expect(createBooking).not.toHaveBeenCalled()
  })
})
