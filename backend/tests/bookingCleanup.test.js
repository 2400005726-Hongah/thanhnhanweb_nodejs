import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const now = new Date('2099-08-03T10:00:00.000Z')
const expiredBookingId = randomUUID()
const successfulBookingId = randomUUID()
const confirmedBookingId = randomUUID()
const otherBookingId = randomUUID()
const expiredSeatId = randomUUID()
const otherSeatId = randomUUID()

let bookings
let items
let seats
let auditLogs

const transaction = {
  $queryRaw: jest.fn(async () => []),
  booking: {
    findUnique: jest.fn(async ({ where }) =>
      bookings.find((booking) => booking.id === where.id) || null,
    ),
    updateMany: jest.fn(async ({ where, data }) => {
      const booking = bookings.find(
        (candidate) =>
          candidate.id === where.id &&
          candidate.source === where.source &&
          candidate.status === where.status &&
          candidate.paymentStatus === where.paymentStatus &&
          candidate.expiresAt <= where.expiresAt.lte,
      )
      if (!booking) return { count: 0 }
      Object.assign(booking, data)
      return { count: 1 }
    }),
  },
  bookingItem: {
    findMany: jest.fn(async ({ where }) =>
      items
        .filter((item) => item.bookingId === where.bookingId)
        .map((item) => ({ tripSeatId: item.tripSeatId })),
    ),
  },
  tripSeat: {
    updateMany: jest.fn(async ({ where, data }) => {
      const matched = seats.filter(
        (seat) =>
          where.id.in.includes(seat.id) && seat.status === where.status,
      )
      matched.forEach((seat) => Object.assign(seat, data))
      return { count: matched.length }
    }),
  },
  auditLog: {
    create: jest.fn(async ({ data }) => {
      auditLogs.push(data)
      return data
    }),
  },
}

const prisma = {
  booking: {
    findMany: jest.fn(async ({ where, take }) =>
      bookings
        .filter(
          (booking) =>
            booking.source === where.source &&
            booking.status === where.status &&
            booking.paymentStatus === where.paymentStatus &&
            booking.expiresAt &&
            booking.expiresAt <= where.expiresAt.lte,
        )
        .slice(0, take)
        .map(({ id }) => ({ id })),
    ),
  },
  $transaction: jest.fn(async (callback) => callback(transaction)),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { cleanupExpiredBookings } = await import(
  '../src/jobs/bookingCleanup.js'
)

beforeEach(() => {
  bookings = [
    {
      id: expiredBookingId,
      source: 'ONLINE',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      expiresAt: new Date(now.getTime() - 60_000),
    },
    {
      id: successfulBookingId,
      source: 'ONLINE',
      status: 'PENDING',
      paymentStatus: 'SUCCESS',
      expiresAt: new Date(now.getTime() - 60_000),
    },
    {
      id: confirmedBookingId,
      source: 'ONLINE',
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
      expiresAt: new Date(now.getTime() - 60_000),
    },
    {
      id: otherBookingId,
      source: 'HOTLINE',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      expiresAt: new Date(now.getTime() - 60_000),
    },
  ]
  items = [
    { bookingId: expiredBookingId, tripSeatId: expiredSeatId },
    { bookingId: otherBookingId, tripSeatId: otherSeatId },
  ]
  seats = [
    { id: expiredSeatId, status: 'BOOKED' },
    { id: otherSeatId, status: 'BOOKED' },
  ]
  auditLogs = []
  jest.clearAllMocks()
})

describe('Phase 4 booking expiry cleanup', () => {
  test('expires an unpaid Online booking and releases only its BookingItem seats', async () => {
    const result = await cleanupExpiredBookings({ now, database: prisma })

    expect(result).toMatchObject({
      candidateCount: 1,
      expiredBookingCount: 1,
      releasedSeatCount: 1,
      errorCount: 0,
    })
    expect(bookings[0].status).toBe('EXPIRED')
    expect(seats.find((seat) => seat.id === expiredSeatId).status).toBe('AVAILABLE')
    expect(seats.find((seat) => seat.id === otherSeatId).status).toBe('BOOKED')
    expect(items).toHaveLength(2)
  })

  test('is idempotent when cleanup runs twice', async () => {
    await cleanupExpiredBookings({ now, database: prisma })
    const second = await cleanupExpiredBookings({ now, database: prisma })

    expect(second.expiredBookingCount).toBe(0)
    expect(second.releasedSeatCount).toBe(0)
    expect(auditLogs).toHaveLength(1)
  })

  test('does not expire SUCCESS, CONFIRMED or non-Online bookings', async () => {
    await cleanupExpiredBookings({ now, database: prisma })

    expect(bookings.find((booking) => booking.id === successfulBookingId).status).toBe('PENDING')
    expect(bookings.find((booking) => booking.id === confirmedBookingId).status).toBe('CONFIRMED')
    expect(bookings.find((booking) => booking.id === otherBookingId).status).toBe('PENDING')
  })

  test('writes a minimal EXPIRE_BOOKING audit record', async () => {
    await cleanupExpiredBookings({ now, database: prisma })

    expect(auditLogs[0]).toMatchObject({
      userId: null,
      role: null,
      action: 'EXPIRE_BOOKING',
      entityType: 'BOOKING',
      entityId: expiredBookingId,
      metadata: {
        source: 'ONLINE',
        releasedSeatCount: 1,
        expiredAt: now.toISOString(),
      },
    })
    expect(JSON.stringify(auditLogs[0])).not.toContain('passenger')
  })

  test('reports one booking error without crashing the cleanup batch', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('isolated failure'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(
        cleanupExpiredBookings({ now, database: prisma }),
      ).resolves.toMatchObject({
        candidateCount: 1,
        expiredBookingCount: 0,
        releasedSeatCount: 0,
        errorCount: 1,
      })
      expect(bookings[0].status).toBe('PENDING')
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
