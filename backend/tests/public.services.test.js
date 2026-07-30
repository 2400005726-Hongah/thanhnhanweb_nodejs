import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const departureLocationId = randomUUID()
const arrivalLocationId = randomUUID()
const routeId = randomUUID()
const busId = randomUUID()
const tripId = randomUUID()
const futureDeparture = new Date('2099-07-25T12:00:00.000Z')

const departureLocation = { id: departureLocationId, name: 'Krông Năng', province: 'Đắk Lắk', address: null }
const arrivalLocation = { id: arrivalLocationId, name: 'TP. Hồ Chí Minh', province: 'TP. Hồ Chí Minh', address: null }
const trip = {
  id: tripId,
  departureTime: futureDeparture,
  expectedArrivalTime: new Date('2099-07-25T20:00:00.000Z'),
  ticketPrice: 300000,
  status: 'OPEN',
  route: { id: routeId, routeName: 'Krông Năng → TP. Hồ Chí Minh', departureLocation, arrivalLocation, distanceKm: 380, estimatedDurationMinutes: 480 },
  bus: { id: busId, busName: 'Xe giường nằm', licensePlate: '47B04444', busType: 'SLEEPER', capacity: 44 },
}

let routeExists = true
let tripExists = true
const prisma = {
  location: {
    findMany: jest.fn(async ({ where }) => where.id ? [{ id: departureLocationId }, { id: arrivalLocationId }] : [departureLocation, arrivalLocation]),
  },
  route: { findFirst: jest.fn(async () => routeExists ? { id: routeId } : null) },
  trip: {
    findMany: jest.fn(async () => [trip]),
    count: jest.fn(async () => 1),
    findFirst: jest.fn(async () => tripExists ? trip : null),
  },
  tripSeat: {
    groupBy: jest.fn(async ({ by }) => by.includes('tripId')
      ? [{ tripId, _count: { _all: 3 } }]
      : [
          { status: 'AVAILABLE', _count: { _all: 2 } },
          { status: 'HELD', _count: { _all: 2 } },
          { status: 'BOOKED', _count: { _all: 1 } },
        ]),
    count: jest.fn(async () => 1),
    updateMany: jest.fn(async () => ({ count: 1 })),
    findMany: jest.fn(async () => [
      { id: randomUUID(), seatCode: 'A01', floor: 1, seatType: 'NORMAL', price: 300000, status: 'AVAILABLE' },
      { id: randomUUID(), seatCode: 'A02', floor: 1, seatType: 'NORMAL', price: 300000, status: 'BOOKED' },
    ]),
  },
  $transaction: jest.fn(async (callback) => callback(prisma)),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const {
  getPublicLocations,
  getPublicTripDetail,
  getPublicTripSeats,
  searchPublicTrips,
} = await import('../src/services/publicTrip.service.js')

beforeEach(() => {
  routeExists = true
  tripExists = true
  jest.clearAllMocks()
})

describe('Public trip service business rules', () => {
  test('only requests ACTIVE locations and public fields', async () => {
    const data = await getPublicLocations({ keyword: '' })
    expect(data.locations).toHaveLength(2)
    expect(prisma.location.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE' },
      select: expect.not.objectContaining({ passwordHash: true }),
    }))
  })

  test('searches only OPEN future trips and counts expired HELD as available', async () => {
    const data = await searchPublicTrips({
      departureLocationId,
      arrivalLocationId,
      departureDate: '2099-07-25',
      page: 1,
      limit: 10,
    })
    const query = prisma.trip.findMany.mock.calls[0][0]
    expect(query.where.status).toBe('OPEN')
    expect(query.where.departureTime.gte).toBeInstanceOf(Date)
    expect(data.trips[0].availableSeatCount).toBe(3)
    expect(typeof data.trips[0].ticketPrice).toBe('number')
  })

  test('returns an empty page when no ACTIVE route matches', async () => {
    routeExists = false
    const data = await searchPublicTrips({ departureLocationId, arrivalLocationId, departureDate: '2099-07-25' })
    expect(data.trips).toEqual([])
    expect(prisma.trip.findMany).not.toHaveBeenCalled()
  })

  test('calculates detail summary with expired HELD seats as available', async () => {
    const data = await getPublicTripDetail(tripId)
    expect(data.summary).toEqual({ total: 5, available: 3, held: 1, booked: 1 })
    expect(data.trip).not.toHaveProperty('createdBy')
  })

  test('rejects unavailable or departed public trips', async () => {
    tripExists = false
    await expect(getPublicTripDetail(tripId)).rejects.toMatchObject({ statusCode: 404 })
  })

  test('releases expired HELD seats and never exposes holder data', async () => {
    const data = await getPublicTripSeats(tripId)
    expect(prisma.tripSeat.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'HELD' }),
      data: { status: 'AVAILABLE', heldBy: null, holdExpiresAt: null },
    }))
    expect(data.summary).toEqual({ total: 2, available: 1, held: 0, booked: 1 })
    expect(data.floors[0].seats[0]).not.toHaveProperty('heldBy')
  })
})
