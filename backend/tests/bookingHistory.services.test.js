import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.BOOKING_CANCEL_BEFORE_MINUTES = '120'

const userId = '018f4d8f-a096-7b3d-b476-9a0cd8fd3f54'
const departureTime = new Date('2099-08-01T12:00:00.000Z')
const booking = {
  id: '118f4d8f-a096-7b3d-b476-9a0cd8fd3f54',
  bookingCode: 'TNABCDEF1234567890',
  userId,
  passengerFullName: 'Nguyễn Văn A',
  passengerPhone: '0987654321',
  passengerEmail: 'a@example.com',
  totalAmount: 640000,
  status: 'CONFIRMED',
  paymentStatus: 'SUCCESS',
  expiresAt: null,
  createdAt: new Date('2099-07-20T10:00:00.000Z'),
  trip: {
    id: '218f4d8f-a096-7b3d-b476-9a0cd8fd3f54',
    departureTime,
    expectedArrivalTime: new Date('2099-08-01T20:00:00.000Z'),
    status: 'OPEN',
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
  },
  items: [
    { seatCode: 'A01', seatType: 'NORMAL', price: 320000 },
    { seatCode: 'A02', seatType: 'NORMAL', price: 320000 },
  ],
  payments: [
    {
      paymentMethod: 'SIMULATED',
      status: 'SUCCESS',
      amount: 640000,
      paidAt: new Date('2099-07-20T10:05:00.000Z'),
    },
  ],
}

const prisma = {
  booking: {
    findMany: jest.fn(async () => [booking]),
    count: jest.fn(async () => 1),
  },
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { listMyBookings, serializeHistoryBooking } = await import(
  '../src/services/bookingHistory.service.js'
)

beforeEach(() => jest.clearAllMocks())

describe('Customer booking history service', () => {
  test('only queries bookings that belong to the authenticated customer', async () => {
    await listMyBookings({ userId })

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } }),
    )
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { userId } })
  })

  test('applies status, payment status, pagination and safe sorting', async () => {
    await listMyBookings({
      userId,
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      page: 3,
      limit: 5,
      sort: 'departureTimeAsc',
    })

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: 'CONFIRMED', paymentStatus: 'SUCCESS' },
        skip: 10,
        take: 5,
        orderBy: { trip: { departureTime: 'asc' } },
      }),
    )
  })

  test('returns pagination metadata', async () => {
    prisma.booking.count.mockResolvedValueOnce(12)

    const result = await listMyBookings({ userId, page: 2, limit: 5 })

    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
    })
  })

  test('serializes Decimal-compatible money values as numbers', () => {
    const result = serializeHistoryBooking(booking, new Date('2099-07-20T10:00:00.000Z'))

    expect(result.totalAmount).toBe(640000)
    expect(result.seats[0].price).toBe(320000)
    expect(result.payment.amount).toBe(640000)
  })

  test('calculates cancellation deadline from the configured window', () => {
    const result = serializeHistoryBooking(booking, new Date('2099-07-20T10:00:00.000Z'))

    expect(result.canCancel).toBe(true)
    expect(result.cancelDeadline).toEqual(
      new Date('2099-08-01T10:00:00.000Z'),
    )
  })

  test('does not expose passwordHash, JWT or internal payment identifiers', () => {
    const serialized = JSON.stringify(
      serializeHistoryBooking(booking, new Date('2099-07-20T10:00:00.000Z')),
    )

    expect(serialized).not.toContain('passwordHash')
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('transactionCode')
    expect(serialized).not.toContain('bookingId')
  })
})
