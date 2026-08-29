import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const bookingId = randomUUID()
const bookingCode = 'TNABCDEF1234567890'
const phone = '0987654321'
const trip = {
  departureTime: new Date('2099-07-25T12:00:00.000Z'),
  expectedArrivalTime: new Date('2099-07-25T20:00:00.000Z'),
  route: {
    routeName: 'Buôn Hồ → Thành phố Hồ Chí Minh',
    departureLocation: { name: 'Buôn Hồ', province: 'Đắk Lắk' },
    arrivalLocation: {
      name: 'Thành phố Hồ Chí Minh',
      province: 'Thành phố Hồ Chí Minh',
    },
  },
  bus: {
    busName: 'Giường nằm Thành Nhân',
    licensePlate: '47B10001',
    busType: 'SLEEPER',
  },
}
const items = [
  { seatCode: 'A01', seatType: 'NORMAL', price: 320000 },
]

let booking
let payments
let failPaymentCreate
let failBookingUpdate
let transactionCodeCollisions

const hydratedBooking = () => ({
  ...booking,
  trip,
  items,
  payments: payments
    .map(({ paymentMethod, amount, transactionCode, status, paidAt }) => ({
      paymentMethod,
      amount,
      transactionCode,
      status,
      paidAt,
    })),
})

const transaction = {
  $queryRaw: jest.fn(async () => []),
  booking: {
    findFirst: jest.fn(async ({ where, include }) => {
      if (
        where.bookingCode !== booking.bookingCode ||
        where.passengerPhone !== booking.passengerPhone
      ) {
        return null
      }
      return include ? hydratedBooking() : { ...booking }
    }),
    update: jest.fn(async ({ where, data }) => {
      if (failBookingUpdate) throw new Error('booking update failure')
      if (where.id !== booking.id) return null
      Object.assign(booking, data)
      return { ...booking }
    }),
    findUnique: jest.fn(async ({ where }) =>
      where.id === booking.id ? hydratedBooking() : null,
    ),
  },
  payment: {
    findFirst: jest.fn(async ({ where }) =>
      payments.find(
        (payment) =>
          payment.bookingId === where.bookingId &&
          (!where.status || payment.status === where.status),
      ) || null,
    ),
    create: jest.fn(async ({ data }) => {
      if (transactionCodeCollisions > 0) {
        transactionCodeCollisions -= 1
        const error = new Error('transaction code collision')
        error.code = 'P2002'
        error.meta = { target: ['transaction_code'] }
        throw error
      }
      if (failPaymentCreate) throw new Error('payment create failure')
      const payment = { id: randomUUID(), ...data }
      payments.push(payment)
      return {
        id: payment.id,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount,
        transactionCode: payment.transactionCode,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: new Date(),
      }
    }),
  },
}

const prisma = {
  ...transaction,
  $transaction: jest.fn(async (callback) => {
    const bookingSnapshot = { ...booking }
    const paymentSnapshot = payments.map((payment) => ({ ...payment }))
    try {
      return await callback(transaction)
    } catch (error) {
      booking = bookingSnapshot
      payments = paymentSnapshot
      throw error
    }
  }),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { createInitialPayment, lookupBooking, simulatePayment } = await import(
  '../src/services/payment.service.js'
)

beforeEach(() => {
  booking = {
    id: bookingId,
    bookingCode,
    source: 'ONLINE',
    userId: null,
    tripId: randomUUID(),
    passengerFullName: 'Khách Task 8',
    passengerPhone: phone,
    passengerEmail: 'private@example.com',
    totalAmount: 320000,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    expiresAt: new Date('2099-07-20T10:15:00.000Z'),
    createdAt: new Date('2099-07-20T10:00:00.000Z'),
  }
  payments = []
  failPaymentCreate = false
  failBookingUpdate = false
  transactionCodeCollisions = 0
  jest.clearAllMocks()
})

describe('Simulated payment transaction service', () => {
  test('uses Booking.totalAmount and confirms booking with one SUCCESS payment', async () => {
    const result = await simulatePayment({
      bookingCode: bookingCode.toLowerCase(),
      phone: '+84987654321',
      paymentMethod: 'SIMULATED',
      amount: 1,
    })

    expect(result.booking.status).toBe('CONFIRMED')
    expect(result.booking.paymentStatus).toBe('SUCCESS')
    expect(booking.expiresAt).toBeNull()
    expect(result.payment.amount).toBe(320000)
    expect(result.payment.paymentMethod).toBe('SIMULATED')
    expect(result.payment.status).toBe('SUCCESS')
    expect(result.payment.transactionCode).toMatch(/^TN\d{9}$/)
    expect(result.payment.paidAt).toBeInstanceOf(Date)
    expect(payments).toHaveLength(1)
    expect(transaction.$queryRaw).toHaveBeenCalled()
  })

  test('prevents a second successful payment', async () => {
    await simulatePayment({ bookingCode, phone, paymentMethod: 'SIMULATED' })

    await expect(
      simulatePayment({ bookingCode, phone, paymentMethod: 'SIMULATED' }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(payments).toHaveLength(1)
  })

  test('rejects payment after the Online booking expiry time', async () => {
    booking.expiresAt = new Date('2000-01-01T00:00:00.000Z')

    await expect(
      simulatePayment({ bookingCode, phone, paymentMethod: 'SIMULATED' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Booking đã hết thời hạn thanh toán',
    })
    expect(payments).toHaveLength(0)
    expect(booking.status).toBe('PENDING')
  })

  test.each([
    ['unknown code', 'TN0000000000000000', phone],
    ['wrong phone', bookingCode, '0900000000'],
  ])('returns the same not-found response for %s', async (_label, code, number) => {
    await expect(
      simulatePayment({ bookingCode: code, phone: number, paymentMethod: 'SIMULATED' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Không tìm thấy booking phù hợp',
    })
    expect(payments).toHaveLength(0)
  })

  test('rolls back when Payment creation fails', async () => {
    failPaymentCreate = true

    await expect(
      simulatePayment({ bookingCode, phone, paymentMethod: 'SIMULATED' }),
    ).rejects.toThrow('payment create failure')
    expect(booking.status).toBe('PENDING')
    expect(booking.paymentStatus).toBe('PENDING')
    expect(payments).toHaveLength(0)
  })

  test('rolls back the Payment when Booking update fails', async () => {
    failBookingUpdate = true

    await expect(
      simulatePayment({ bookingCode, phone, paymentMethod: 'SIMULATED' }),
    ).rejects.toThrow('booking update failure')
    expect(booking.status).toBe('PENDING')
    expect(booking.paymentStatus).toBe('PENDING')
    expect(payments).toHaveLength(0)
  })

  test('retries a rare transaction-code collision', async () => {
    transactionCodeCollisions = 1

    const result = await simulatePayment({
      bookingCode,
      phone,
      paymentMethod: 'SIMULATED',
    })

    expect(result.payment.status).toBe('SUCCESS')
    expect(transaction.payment.create).toHaveBeenCalledTimes(2)
    expect(payments).toHaveLength(1)
  })
})

describe('Public booking lookup service', () => {
  test('normalizes booking code and phone and returns a strict public DTO', async () => {
    const result = await lookupBooking({
      bookingCode: bookingCode.toLowerCase(),
      phone: '+84987654321',
    })
    const serialized = JSON.stringify(result)

    expect(result.booking.bookingCode).toBe(bookingCode)
    expect(result.booking.seats[0].seatCode).toBe('A01')
    expect(result.payment).toBeNull()
    for (const forbidden of [
      '"id"',
      'userId',
      'tripId',
      'bookingId',
      'passwordHash',
      'heldBy',
      'holdExpiresAt',
      'passengerEmail',
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
    expect(transaction.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingCode, passengerPhone: phone },
      }),
    )
  })

  test('returns public payment information after successful payment', async () => {
    await simulatePayment({ bookingCode, phone, paymentMethod: 'SIMULATED' })

    const result = await lookupBooking({ bookingCode, phone })

    expect(result.booking.status).toBe('CONFIRMED')
    expect(result.payment.status).toBe('SUCCESS')
    expect(result.payment.amount).toBe(320000)
  })

  test('returns pending PAY_AT_BUS information without pretending it is paid', async () => {
    payments.push({
      id: randomUUID(),
      bookingId,
      paymentMethod: 'PAY_AT_BUS',
      amount: 320000,
      transactionCode: null,
      status: 'PENDING',
      paidAt: null,
    })
    booking.status = 'CONFIRMED'
    booking.paymentStatus = 'PENDING'
    booking.expiresAt = null

    const result = await lookupBooking({ bookingCode, phone })

    expect(result.booking).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
    })
    expect(result.payment).toEqual({
      paymentMethod: 'PAY_AT_BUS',
      amount: 320000,
      transactionCode: null,
      status: 'PENDING',
      paidAt: null,
    })
  })
})

describe('Initial Payment duplicate protection', () => {
  test('does not create a second Payment for the same booking', async () => {
    const input = {
      database: transaction,
      bookingId,
      source: 'COUNTER',
      paymentMethod: 'CASH_COUNTER',
      amount: 320000,
      actor: { id: randomUUID(), role: 'STAFF' },
    }

    await createInitialPayment(input)

    await expect(createInitialPayment(input)).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({
      amount: 320000,
      status: 'SUCCESS',
      paymentMethod: 'CASH_COUNTER',
    })
  })
})
