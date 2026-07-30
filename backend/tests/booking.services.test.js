import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.SEAT_HOLD_MINUTES = '10'

const tripId = randomUUID()
const otherTripId = randomUUID()
const seatIdA = randomUUID()
const seatIdB = randomUUID()
const futureDeparture = new Date('2099-07-25T12:00:00.000Z')
const trip = {
  id: tripId,
  status: 'OPEN',
  departureTime: futureDeparture,
  expectedArrivalTime: new Date('2099-07-25T20:00:00.000Z'),
  route: {
    id: randomUUID(),
    routeName: 'Buôn Hồ → Thành phố Hồ Chí Minh',
    departureLocation: { id: randomUUID(), name: 'Buôn Hồ', province: 'Đắk Lắk' },
    arrivalLocation: { id: randomUUID(), name: 'Thành phố Hồ Chí Minh', province: 'Thành phố Hồ Chí Minh' },
  },
  bus: {
    id: randomUUID(),
    busName: 'Giường nằm Thành Nhân',
    licensePlate: '47B10001',
    busType: 'SLEEPER',
  },
}

let seats
let bookings
let bookingItems
let currentTrip
let failBookingItems

const cloneState = () => ({
  seats: seats.map((seat) => ({ ...seat })),
  bookings: bookings.map((booking) => ({ ...booking })),
  bookingItems: bookingItems.map((item) => ({ ...item })),
})

const restoreState = (snapshot) => {
  seats = snapshot.seats
  bookings = snapshot.bookings
  bookingItems = snapshot.bookingItems
}

const updateSeats = (where, data) => {
  const matching = seats.filter((seat) => {
    if (where.tripId && seat.tripId !== where.tripId) return false
    if (where.status && seat.status !== where.status) return false
    if (where.heldBy && seat.heldBy !== where.heldBy) return false
    if (where.id?.in && !where.id.in.includes(seat.id)) return false
    if (where.holdExpiresAt?.lte && !(seat.holdExpiresAt <= where.holdExpiresAt.lte)) return false
    if (where.holdExpiresAt?.gt && !(seat.holdExpiresAt > where.holdExpiresAt.gt)) return false
    return true
  })
  matching.forEach((seat) => Object.assign(seat, data))
  return { count: matching.length }
}

const transaction = {
  $queryRaw: jest.fn(async (strings, ...values) => {
    const sql = strings.join(' ')
    if (sql.includes('held_by')) {
      const [lockedTripId, holdToken] = values
      return seats
        .filter(
          (seat) =>
            seat.tripId === lockedTripId &&
            seat.heldBy === holdToken &&
            seat.status === 'HELD',
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((seat) => ({ id: seat.id }))
    }
    return []
  }),
  trip: {
    findUnique: jest.fn(async ({ where }) =>
      currentTrip?.id === where.id ? currentTrip : null,
    ),
  },
  tripSeat: {
    updateMany: jest.fn(async ({ where, data }) => updateSeats(where, data)),
    findMany: jest.fn(async ({ where }) =>
      seats
        .filter((seat) => where.id.in.includes(seat.id))
        .sort((left, right) => left.seatCode.localeCompare(right.seatCode)),
    ),
  },
  booking: {
    create: jest.fn(async ({ data }) => {
      const booking = {
        id: randomUUID(),
        createdAt: new Date(),
        expiresAt: null,
        ...data,
      }
      bookings.push(booking)
      return { id: booking.id }
    }),
    findUnique: jest.fn(async ({ where }) => {
      const booking = bookings.find((item) => item.id === where.id)
      return {
        ...booking,
        trip,
        items: bookingItems
          .filter((item) => item.bookingId === booking.id)
          .sort((left, right) => left.seatCode.localeCompare(right.seatCode)),
      }
    }),
  },
  bookingItem: {
    createMany: jest.fn(async ({ data }) => {
      if (failBookingItems) throw new Error('booking item failure')
      bookingItems.push(...data)
      return { count: data.length }
    }),
  },
}

const prisma = {
  ...transaction,
  $transaction: jest.fn(async (callback) => {
    const snapshot = cloneState()
    try {
      return await callback(transaction)
    } catch (error) {
      restoreState(snapshot)
      throw error
    }
  }),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { createBooking, holdSeats, releaseSeatHold } = await import(
  '../src/services/booking.service.js'
)

const resetSeats = () => [
  {
    id: seatIdA,
    tripId,
    seatCode: 'A01',
    floor: 1,
    seatType: 'NORMAL',
    price: 300000,
    status: 'AVAILABLE',
    heldBy: null,
    holdExpiresAt: null,
  },
  {
    id: seatIdB,
    tripId,
    seatCode: 'A02',
    floor: 1,
    seatType: 'NORMAL',
    price: 320000,
    status: 'AVAILABLE',
    heldBy: null,
    holdExpiresAt: null,
  },
]

beforeEach(() => {
  seats = resetSeats()
  bookings = []
  bookingItems = []
  currentTrip = { ...trip }
  failBookingItems = false
  jest.clearAllMocks()
})

describe('Seat hold transaction service', () => {
  test('holds multiple AVAILABLE seats and calculates the server total', async () => {
    const result = await holdSeats(tripId, [seatIdB, seatIdA])

    expect(result.totalAmount).toBe(620000)
    expect(result.seats.map((seat) => seat.seatCode)).toEqual(['A01', 'A02'])
    expect(result.holdToken).toMatch(/^[a-f0-9]{64}$/)
    expect(seats.every((seat) => seat.status === 'HELD')).toBe(true)
    expect(transaction.$queryRaw).toHaveBeenCalled()
  })

  test('rejects a seat that does not belong to the selected trip', async () => {
    seats[1].tripId = otherTripId

    await expect(holdSeats(tripId, [seatIdA, seatIdB])).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(seats.every((seat) => seat.status === 'AVAILABLE')).toBe(true)
  })

  test.each(['BOOKED', 'HELD'])('rejects a non-available %s seat', async (status) => {
    seats[0].status = status
    if (status === 'HELD') {
      seats[0].heldBy = 'b'.repeat(64)
      seats[0].holdExpiresAt = new Date(Date.now() + 60000)
    }

    await expect(holdSeats(tripId, [seatIdA])).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  test('reclaims and holds an expired HELD seat', async () => {
    seats[0].status = 'HELD'
    seats[0].heldBy = 'b'.repeat(64)
    seats[0].holdExpiresAt = new Date(Date.now() - 60000)

    const result = await holdSeats(tripId, [seatIdA])

    expect(result.seats[0].status).toBe('HELD')
    expect(seats[0].heldBy).toBe(result.holdToken)
  })

  test('rejects a closed or departed trip', async () => {
    currentTrip.status = 'CLOSED'
    await expect(holdSeats(tripId, [seatIdA])).rejects.toMatchObject({
      statusCode: 409,
    })

    currentTrip = { ...trip, departureTime: new Date('2000-01-01T00:00:00Z') }
    await expect(holdSeats(tripId, [seatIdA])).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  test('only releases HELD seats owned by the supplied token', async () => {
    const hold = await holdSeats(tripId, [seatIdA])
    seats[1].status = 'HELD'
    seats[1].heldBy = 'c'.repeat(64)
    seats[1].holdExpiresAt = new Date(Date.now() + 60000)

    const result = await releaseSeatHold(tripId, hold.holdToken)

    expect(result.releasedSeatCount).toBe(1)
    expect(seats[0].status).toBe('AVAILABLE')
    expect(seats[1].status).toBe('HELD')
  })

  test('allows only the first request to hold the same seat', async () => {
    await holdSeats(tripId, [seatIdA])

    await expect(holdSeats(tripId, [seatIdA])).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})

describe('Booking transaction service', () => {
  const passenger = {
    fullName: ' Nguyễn Văn A ',
    phone: '+84987654321',
    email: 'A@EXAMPLE.COM',
  }

  test('creates Booking and BookingItem records and marks seats BOOKED', async () => {
    const hold = await holdSeats(tripId, [seatIdA, seatIdB])
    const result = await createBooking({ tripId, holdToken: hold.holdToken, passenger })

    expect(result.booking.status).toBe('PENDING')
    expect(result.booking.paymentStatus).toBe('PENDING')
    expect(result.booking.totalAmount).toBe(620000)
    expect(result.booking.passenger.phone).toBe('0987654321')
    expect(result.booking.passenger.email).toBe('a@example.com')
    expect(result.booking.seats).toHaveLength(2)
    expect(bookingItems).toHaveLength(2)
    expect(seats.every((seat) => seat.status === 'BOOKED')).toBe(true)
    expect(seats.every((seat) => seat.heldBy === null)).toBe(true)
  })

  test('does not trust a totalAmount supplied to the service', async () => {
    const hold = await holdSeats(tripId, [seatIdA])
    const result = await createBooking({
      tripId,
      holdToken: hold.holdToken,
      passenger,
      totalAmount: 1,
    })

    expect(result.booking.totalAmount).toBe(300000)
  })

  test('rejects an expired hold without creating a booking', async () => {
    const hold = await holdSeats(tripId, [seatIdA])
    seats[0].holdExpiresAt = new Date(Date.now() - 1000)

    await expect(
      createBooking({ tripId, holdToken: hold.holdToken, passenger }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(bookings).toHaveLength(0)
    expect(bookingItems).toHaveLength(0)
  })

  test('rolls back Booking when BookingItem creation fails', async () => {
    const hold = await holdSeats(tripId, [seatIdA])
    failBookingItems = true

    await expect(
      createBooking({ tripId, holdToken: hold.holdToken, passenger }),
    ).rejects.toThrow('booking item failure')
    expect(bookings).toHaveLength(0)
    expect(bookingItems).toHaveLength(0)
    expect(seats[0].status).toBe('HELD')
    expect(seats[0].heldBy).toBe(hold.holdToken)
  })

  test('prevents a second booking from using seats already BOOKED', async () => {
    const hold = await holdSeats(tripId, [seatIdA])
    await createBooking({ tripId, holdToken: hold.holdToken, passenger })

    await expect(
      createBooking({ tripId, holdToken: hold.holdToken, passenger }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(bookings).toHaveLength(1)
  })
})
