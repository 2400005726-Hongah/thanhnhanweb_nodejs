import { jest } from '@jest/globals'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const bookingCode = 'TNABCDEF1234567890'
const phone = '0987654321'
const publicResult = {
  booking: {
    bookingCode,
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    totalAmount: 320000,
  },
  payment: {
    paymentMethod: 'SIMULATED',
    amount: 320000,
    transactionCode: 'PAYABCDEF12345678901234',
    status: 'SUCCESS',
  },
}
const simulatePayment = jest.fn(async () => publicResult)
const lookupBooking = jest.fn(async () => publicResult)

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: {} }))
jest.unstable_mockModule('../src/services/payment.service.js', () => ({
  lookupBooking,
  simulatePayment,
}))

const { default: app } = await import('../src/app.js')

beforeEach(() => jest.clearAllMocks())

describe('Simulated payment API', () => {
  test('pays a pending booking without accepting an amount', async () => {
    const response = await request(app)
      .post(`/api/v1/public/bookings/${bookingCode}/payments/simulate`)
      .send({ phone, paymentMethod: 'SIMULATED' })

    expect(response.statusCode).toBe(201)
    expect(response.body.data.payment.status).toBe('SUCCESS')
    expect(simulatePayment).toHaveBeenCalledWith({
      bookingCode,
      phone,
      paymentMethod: 'SIMULATED',
    })
  })

  test.each([
    ['invalid booking code', 'BAD-CODE', phone, 'SIMULATED'],
    ['invalid phone', bookingCode, '123', 'SIMULATED'],
    ['unsupported method', bookingCode, phone, 'BANK_TRANSFER'],
  ])('rejects %s', async (_label, code, suppliedPhone, paymentMethod) => {
    const response = await request(app)
      .post(`/api/v1/public/bookings/${code}/payments/simulate`)
      .send({ phone: suppliedPhone, paymentMethod })

    expect(response.statusCode).toBe(400)
    expect(simulatePayment).not.toHaveBeenCalled()
  })

  test('rejects server-owned payment fields', async () => {
    const response = await request(app)
      .post(`/api/v1/public/bookings/${bookingCode}/payments/simulate`)
      .send({
        phone,
        paymentMethod: 'SIMULATED',
        amount: 1,
        status: 'SUCCESS',
        transactionCode: 'CLIENT-CODE',
      })

    expect(response.statusCode).toBe(400)
    expect(simulatePayment).not.toHaveBeenCalled()
  })
})

describe('Public booking lookup API', () => {
  test('looks up a booking using code and phone', async () => {
    const response = await request(app)
      .get('/api/v1/public/bookings/lookup')
      .query({ bookingCode: bookingCode.toLowerCase(), phone: '+84987654321' })

    expect(response.statusCode).toBe(200)
    expect(response.body.data.booking.bookingCode).toBe(bookingCode)
    expect(lookupBooking).toHaveBeenCalledWith({
      bookingCode: bookingCode.toLowerCase(),
      phone: '+84987654321',
    })
  })

  test.each([
    ['missing queries', {}],
    ['invalid booking code', { bookingCode: 'BAD', phone }],
    ['invalid phone', { bookingCode, phone: '123' }],
  ])('rejects %s', async (_label, query) => {
    const response = await request(app)
      .get('/api/v1/public/bookings/lookup')
      .query(query)

    expect(response.statusCode).toBe(400)
    expect(lookupBooking).not.toHaveBeenCalled()
  })

  test('does not expose internal identifiers in the public response', async () => {
    const response = await request(app)
      .get('/api/v1/public/bookings/lookup')
      .query({ bookingCode, phone })
    const responseText = JSON.stringify(response.body)

    expect(responseText).not.toContain('userId')
    expect(responseText).not.toContain('bookingId')
    expect(responseText).not.toContain('passwordHash')
    expect(responseText).not.toContain('heldBy')
  })
})
