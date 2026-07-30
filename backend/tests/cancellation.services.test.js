import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.BOOKING_CANCEL_BEFORE_MINUTES = '120'

const bookingId = randomUUID()
const userId = randomUUID()
const otherUserId = randomUUID()
const bookingCode = 'TNABCDEF1234567890'
const phone = '0987654321'
const seatIds = [randomUUID(), randomUUID()]
const otherSeatId = randomUUID()
const now = new Date('2099-07-20T08:00:00.000Z')

let booking
let tripSeats
let payments
let bookingItems
let failSeatUpdate
let failPaymentUpdate
let transactionConflicts
let transactionQueue

const transaction = {
  $queryRaw: jest.fn(async () => []),
  booking: {
    findFirst: jest.fn(async ({ where }) => {
      if (where.bookingCode !== booking.bookingCode) return null
      if (where.userId && where.userId !== booking.userId) return null
      if (
        where.passengerPhone &&
        where.passengerPhone !== booking.passengerPhone
      ) {
        return null
      }

      return {
        ...booking,
        trip: { ...booking.trip },
        items: bookingItems.map((item) => ({ ...item })),
      }
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      if (
        where.id !== booking.id ||
        !where.status.in.includes(booking.status)
      ) {
        return { count: 0 }
      }
      Object.assign(booking, data)
      return { count: 1 }
    }),
  },
  tripSeat: {
    findMany: jest.fn(async ({ where }) =>
      tripSeats
        .filter((seat) => where.id.in.includes(seat.id))
        .map((seat) => ({ id: seat.id, status: seat.status }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ),
    updateMany: jest.fn(async ({ where, data }) => {
      if (failSeatUpdate) throw new Error('trip seat update failure')
      let count = 0
      for (const seat of tripSeats) {
        if (where.id.in.includes(seat.id) && seat.status === where.status) {
          Object.assign(seat, data)
          count += 1
        }
      }
      return { count }
    }),
  },
  payment: {
    findMany: jest.fn(async ({ where }) =>
      payments
        .filter(
          (payment) =>
            payment.bookingId === where.bookingId &&
            payment.status === where.status,
        )
        .map(({ id, amount }) => ({ id, amount }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ),
    updateMany: jest.fn(async ({ where, data }) => {
      if (failPaymentUpdate) throw new Error('payment update failure')
      let count = 0
      for (const payment of payments) {
        if (
          where.id.in.includes(payment.id) &&
          payment.bookingId === where.bookingId &&
          payment.status === where.status
        ) {
          Object.assign(payment, data)
          count += 1
        }
      }
      return { count }
    }),
  },
}

const prisma = {
  $transaction: jest.fn((callback, options) => {
    const run = async () => {
      if (transactionConflicts > 0) {
        transactionConflicts -= 1
        const error = new Error('write conflict')
        error.code = 'P2034'
        throw error
      }

      const bookingSnapshot = structuredClone(booking)
      const seatSnapshot = structuredClone(tripSeats)
      const paymentSnapshot = structuredClone(payments)
      try {
        return await callback(transaction)
      } catch (error) {
        booking = bookingSnapshot
        tripSeats = seatSnapshot
        payments = paymentSnapshot
        throw error
      }
    }

    const result = transactionQueue.then(run, run)
    transactionQueue = result.catch(() => {})
    return result
  }),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { cancelBooking, getCancellationState } = await import(
  '../src/services/cancellation.service.js'
)

beforeEach(() => {
  booking = {
    id: bookingId,
    bookingCode,
    userId,
    passengerPhone: phone,
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    totalAmount: 640000,
    trip: {
      id: randomUUID(),
      status: 'OPEN',
      departureTime: new Date('2099-07-20T14:00:00.000Z'),
    },
  }
  bookingItems = seatIds.map((tripSeatId) => ({ tripSeatId }))
  tripSeats = [
    ...seatIds.map((id) => ({
      id,
      status: 'BOOKED',
      heldBy: null,
      holdExpiresAt: null,
    })),
    { id: otherSeatId, status: 'BOOKED', heldBy: null, holdExpiresAt: null },
  ]
  payments = [
    {
      id: randomUUID(),
      bookingId,
      amount: 640000,
      status: 'SUCCESS',
    },
    {
      id: randomUUID(),
      bookingId,
      amount: 640000,
      status: 'FAILED',
    },
  ]
  failSeatUpdate = false
  failPaymentUpdate = false
  transactionConflicts = 0
  transactionQueue = Promise.resolve()
  jest.clearAllMocks()
})

describe('Booking cancellation transaction service', () => {
  test('customer cancels their own paid booking and receives a simulated refund', async () => {
    const result = await cancelBooking({ bookingCode, userId, now })

    expect(result).toEqual({
      bookingCode,
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      releasedSeatCount: 2,
      refunded: true,
      refundAmount: 640000,
    })
    expect(booking.status).toBe('CANCELLED')
    expect(booking.paymentStatus).toBe('REFUNDED')
    expect(payments[0].status).toBe('REFUNDED')
    expect(payments[1].status).toBe('FAILED')
  })

  test('guest cancels with matching normalized booking code and phone', async () => {
    const result = await cancelBooking({
      bookingCode: bookingCode.toLowerCase(),
      phone: '+84987654321',
      now,
    })

    expect(result.status).toBe('CANCELLED')
    expect(transaction.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingCode, passengerPhone: phone },
      }),
    )
  })

  test('customer cannot cancel another customer booking', async () => {
    await expect(
      cancelBooking({ bookingCode, userId: otherUserId, now }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Không tìm thấy booking phù hợp',
    })
  })

  test.each([
    ['wrong code', 'TN0000000000000000', phone],
    ['wrong phone', bookingCode, '0900000000'],
  ])('guest receives the same not-found response for %s', async (_label, code, suppliedPhone) => {
    await expect(
      cancelBooking({ bookingCode: code, phone: suppliedPhone, now }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Không thể hủy vé với thông tin đã cung cấp',
    })
  })

  test.each(['CANCELLED', 'COMPLETED', 'EXPIRED'])(
    'rejects a booking in %s status',
    async (status) => {
      booking.status = status

      await expect(
        cancelBooking({ bookingCode, userId, now }),
      ).rejects.toMatchObject({ statusCode: 409 })
    },
  )

  test('rejects cancellation after the configured deadline', async () => {
    booking.trip.departureTime = new Date('2099-07-20T09:30:00.000Z')

    await expect(
      cancelBooking({ bookingCode, userId, now }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Đã quá thời hạn cho phép hủy vé',
    })
  })

  test('rejects cancellation after trip departure', async () => {
    booking.trip.departureTime = new Date('2099-07-20T07:30:00.000Z')

    await expect(
      cancelBooking({ bookingCode, userId, now }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Không thể hủy vé sau khi chuyến đã khởi hành',
    })
  })

  test('unpaid booking creates no Payment and preserves payment status', async () => {
    booking.status = 'PENDING'
    booking.paymentStatus = 'PENDING'
    payments = []

    const result = await cancelBooking({ bookingCode, userId, now })

    expect(result.refunded).toBe(false)
    expect(result.refundAmount).toBe(0)
    expect(result.paymentStatus).toBe('PENDING')
    expect(transaction.payment.updateMany).not.toHaveBeenCalled()
    expect(payments).toHaveLength(0)
  })

  test('only releases TripSeat rows referenced by BookingItem', async () => {
    await cancelBooking({ bookingCode, userId, now })

    expect(tripSeats.filter((seat) => seat.id !== otherSeatId))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ status: 'AVAILABLE' }),
        expect.objectContaining({ status: 'AVAILABLE' }),
      ]))
    expect(tripSeats.find((seat) => seat.id === otherSeatId).status)
      .toBe('BOOKED')
  })

  test('keeps BookingItem history unchanged', async () => {
    const snapshot = structuredClone(bookingItems)

    await cancelBooking({ bookingCode, userId, now })

    expect(bookingItems).toEqual(snapshot)
  })

  test('rolls back Booking and Payment when TripSeat update fails', async () => {
    failSeatUpdate = true

    await expect(
      cancelBooking({ bookingCode, userId, now }),
    ).rejects.toThrow('trip seat update failure')
    expect(booking.status).toBe('CONFIRMED')
    expect(booking.paymentStatus).toBe('SUCCESS')
    expect(payments[0].status).toBe('SUCCESS')
  })

  test('rolls back Booking and TripSeat when Payment update fails', async () => {
    failPaymentUpdate = true

    await expect(
      cancelBooking({ bookingCode, userId, now }),
    ).rejects.toThrow('payment update failure')
    expect(booking.status).toBe('CONFIRMED')
    expect(tripSeats.slice(0, 2).every((seat) => seat.status === 'BOOKED'))
      .toBe(true)
    expect(payments[0].status).toBe('SUCCESS')
  })

  test('allows only one of two concurrent cancellation requests to succeed', async () => {
    const results = await Promise.allSettled([
      cancelBooking({ bookingCode, userId, now }),
      cancelBooking({ bookingCode, userId, now }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(payments.filter((payment) => payment.status === 'REFUNDED')).toHaveLength(1)
  })

  test('rejects a second cancellation request', async () => {
    await cancelBooking({ bookingCode, userId, now })

    await expect(
      cancelBooking({ bookingCode, userId, now }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  test('retries a Serializable transaction conflict', async () => {
    transactionConflicts = 1

    const result = await cancelBooking({ bookingCode, userId, now })

    expect(result.status).toBe('CANCELLED')
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(prisma.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    )
  })

  test('calculates canCancel and cancelDeadline from backend configuration', () => {
    const state = getCancellationState(booking, now)

    expect(state.canCancel).toBe(true)
    expect(state.cancelDeadline).toEqual(
      new Date('2099-07-20T12:00:00.000Z'),
    )
  })
})
