import { jest } from '@jest/globals'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.BOOKING_CANCEL_BEFORE_MINUTES = '120'

const customer = {
  id: '018f4d8f-a096-7b3d-b476-9a0cd8fd3f54',
  fullName: 'Khách hàng',
  email: 'customer@example.com',
  phone: '0987654321',
  role: 'CUSTOMER',
  status: 'ACTIVE',
}
const admin = {
  ...customer,
  id: '118f4d8f-a096-7b3d-b476-9a0cd8fd3f54',
  email: 'admin@example.com',
  phone: '0976543210',
  role: 'ADMIN',
}
const bookingCode = 'TNABCDEF1234567890'

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }) =>
      [customer, admin].find((user) => user.id === where.id) || null,
    ),
  },
}

const listResult = {
  bookings: [
    {
      id: '218f4d8f-a096-7b3d-b476-9a0cd8fd3f54',
      bookingCode,
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
}
const cancellationResult = {
  bookingCode,
  status: 'CANCELLED',
  paymentStatus: 'REFUNDED',
  releasedSeatCount: 1,
  refunded: true,
  refundAmount: 320000,
}

const listMyBookings = jest.fn(async () => listResult)
const cancelBooking = jest.fn(async ({ bookingCode: code, userId, phone }) => {
  if (
    code.toUpperCase() !== bookingCode ||
    (userId && userId !== customer.id) ||
    (phone && !['0987654321', '+84987654321'].includes(phone))
  ) {
    const error = new Error(
      phone
        ? 'Không thể hủy vé với thông tin đã cung cấp'
        : 'Không tìm thấy booking phù hợp',
    )
    error.statusCode = 404
    error.errors = []
    throw error
  }

  return cancellationResult
})

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))
jest.unstable_mockModule('../src/services/bookingHistory.service.js', () => ({
  listMyBookings,
}))
jest.unstable_mockModule('../src/services/cancellation.service.js', () => ({
  cancelBooking,
  getCancellationState: jest.fn(() => ({
    canCancel: true,
    cancelDeadline: new Date('2099-07-20T12:00:00.000Z'),
  })),
}))
jest.unstable_mockModule('../src/services/booking.service.js', () => ({
  createBooking: jest.fn(),
  holdSeats: jest.fn(),
  releaseSeatHold: jest.fn(),
}))
jest.unstable_mockModule('../src/services/payment.service.js', () => ({
  lookupBooking: jest.fn(),
  simulatePayment: jest.fn(),
}))

const { generateToken } = await import('../src/utils/jwt.js')
const { default: app } = await import('../src/app.js')

const customerToken = generateToken(customer)
const adminToken = generateToken(admin)

beforeEach(() => jest.clearAllMocks())

describe('Customer booking history API', () => {
  test('GET /bookings/me requires JWT', async () => {
    const response = await request(app).get('/api/v1/bookings/me')

    expect(response.statusCode).toBe(401)
  })

  test('CUSTOMER can only request history using their authenticated id', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${customerToken}`)

    expect(response.statusCode).toBe(200)
    expect(response.body.data).toEqual(listResult)
    expect(listMyBookings).toHaveBeenCalledWith(
      expect.objectContaining({ userId: customer.id }),
    )
  })

  test('does not accept userId from query', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .query({ userId: admin.id })

    expect(response.statusCode).toBe(400)
    expect(listMyBookings).not.toHaveBeenCalled()
  })

  test('validates filters and converts pagination to numbers', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .query({
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        sort: 'departureTimeAsc',
        page: '2',
        limit: '5',
      })

    expect(response.statusCode).toBe(200)
    expect(listMyBookings).toHaveBeenCalledWith({
      userId: customer.id,
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      sort: 'departureTimeAsc',
      page: 2,
      limit: 5,
    })
  })

  test('rejects invalid filter values', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .query({ status: 'UNKNOWN', limit: 1000 })

    expect(response.statusCode).toBe(400)
    expect(listMyBookings).not.toHaveBeenCalled()
  })

  test('ADMIN cannot use the CUSTOMER history route', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.statusCode).toBe(403)
  })
})

describe('Booking cancellation API', () => {
  test('CUSTOMER cancels their own booking without sending a phone', async () => {
    const response = await request(app)
      .post(`/api/v1/bookings/${bookingCode}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)

    expect(response.statusCode).toBe(200)
    expect(response.body.data.status).toBe('CANCELLED')
    expect(cancelBooking).toHaveBeenCalledWith({
      bookingCode,
      userId: customer.id,
    })
  })

  test('CUSTOMER receives 404 for a booking they do not own', async () => {
    const response = await request(app)
      .post('/api/v1/bookings/TN0000000000000000/cancel')
      .set('Authorization', `Bearer ${customerToken}`)

    expect(response.statusCode).toBe(404)
    expect(response.body.message).toBe('Không tìm thấy booking phù hợp')
  })

  test('Guest cancels with booking code and phone', async () => {
    const response = await request(app)
      .post(`/api/v1/public/bookings/${bookingCode}/cancel`)
      .send({ phone: '0987654321' })

    expect(response.statusCode).toBe(200)
    expect(response.body.data.refunded).toBe(true)
    expect(cancelBooking).toHaveBeenCalledWith({
      bookingCode,
      phone: '0987654321',
    })
  })

  test.each([
    ['wrong code', 'TN0000000000000000', '0987654321'],
    ['wrong phone', bookingCode, '0900000000'],
  ])('Guest gets the same safe 404 for %s', async (_label, code, phone) => {
    const response = await request(app)
      .post(`/api/v1/public/bookings/${code}/cancel`)
      .send({ phone })

    expect(response.statusCode).toBe(404)
    expect(response.body).toMatchObject({
      success: false,
      message: 'Không thể hủy vé với thông tin đã cung cấp',
      errors: [],
    })
  })

  test('Guest request validates booking code and phone format', async () => {
    const response = await request(app)
      .post('/api/v1/public/bookings/BAD/cancel')
      .send({ phone: '123' })

    expect(response.statusCode).toBe(400)
    expect(cancelBooking).not.toHaveBeenCalled()
  })
})
