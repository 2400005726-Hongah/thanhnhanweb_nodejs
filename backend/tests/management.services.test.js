import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

const routeId = randomUUID()
const busId = randomUUID()
const adminId = randomUUID()
const departureLocationId = randomUUID()
const arrivalLocationId = randomUUID()
const tripId = randomUUID()

let activeLocationCount
let duplicateRoute
let duplicatePlate
let duplicateSeat
let routeFound
let busFound
let scheduleConflict
let tripSeatInsertError

const prisma = {
  location: {
    count: jest.fn(async () => activeLocationCount),
    findMany: jest.fn(async () => []),
  },
  route: {
    findUnique: jest.fn(async ({ where }) =>
      where.departureLocationId_arrivalLocationId ? duplicateRoute : null,
    ),
    findFirst: jest.fn(async () => routeFound),
    create: jest.fn(async ({ data }) => ({ id: routeId, ...data })),
  },
  bus: {
    findUnique: jest.fn(async ({ where }) => {
      if (where.licensePlate) return duplicatePlate
      if (where.id) return { ...busFound, _count: { seats: busFound.seats.length } }
      return null
    }),
    findFirst: jest.fn(async () => busFound),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn(async ({ data }) => ({ id: busId, ...data })),
  },
  seat: {
    findUnique: jest.fn(async () => duplicateSeat),
    create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
  },
  trip: {
    findFirst: jest.fn(async () =>
      scheduleConflict ? { id: randomUUID() } : null,
    ),
    create: jest.fn(async ({ data }) => ({ id: tripId, ...data })),
    findUnique: jest.fn(async () => ({ id: tripId })),
  },
  tripSeat: {
    count: jest.fn(async () => 0),
    createMany: jest.fn(async ({ data }) => {
      if (tripSeatInsertError) throw tripSeatInsertError
      return { count: data.length }
    }),
  },
  $transaction: jest.fn(async (callback) => callback(prisma)),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { createRoute } = await import('../src/services/route.service.js')
const { addBusSeat, createBus, getBuses } = await import(
  '../src/services/bus.service.js'
)
const { createTrip } = await import('../src/services/trip.service.js')
const { getLocations } = await import('../src/services/location.service.js')

const routePayload = {
  routeName: 'Krong Nang - Ho Chi Minh City',
  departureLocation: departureLocationId,
  arrivalLocation: arrivalLocationId,
  distanceKm: 350,
  estimatedDurationMinutes: 480,
}

const tripPayload = {
  route: routeId,
  bus: busId,
  departureTime: '2099-08-01T01:00:00.000Z',
  expectedArrivalTime: '2099-08-01T09:00:00.000Z',
  ticketPrice: 250000,
}

const makeSeat = (seatCode, status = 'ACTIVE') => ({
  id: randomUUID(),
  busId,
  seatCode,
  floor: 1,
  seatType: 'NORMAL',
  status,
})

beforeEach(() => {
  activeLocationCount = 2
  duplicateRoute = null
  duplicatePlate = null
  duplicateSeat = null
  routeFound = { id: routeId, status: 'ACTIVE' }
  busFound = {
    id: busId,
    capacity: 2,
    status: 'ACTIVE',
    seats: [makeSeat('A1'), makeSeat('A2')],
  }
  scheduleConflict = false
  tripSeatInsertError = null
  jest.clearAllMocks()
})

describe('Prisma list filters', () => {
  test('applies pagination and keyword search to locations', async () => {
    await getLocations({
      query: { keyword: 'Krong', page: '2', limit: '5' },
      isAdmin: false,
    })
    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    )
  })

  test('applies filters to buses', async () => {
    await getBuses({ status: 'ACTIVE', busType: 'SLEEPER', keyword: '51B' })
    expect(prisma.bus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          busType: 'SLEEPER',
        }),
      }),
    )
  })
})

describe('Prisma Route, Bus and Seat rules', () => {
  test('creates a route with two active locations', async () => {
    const route = await createRoute(routePayload)
    expect(route.id).toBe(routeId)
    expect(prisma.route.create).toHaveBeenCalledTimes(1)
  })

  test('rejects a route with equal locations', async () => {
    await expect(
      createRoute({ ...routePayload, arrivalLocation: departureLocationId }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('rejects a route when a location does not exist', async () => {
    activeLocationCount = 1
    await expect(createRoute(routePayload)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  test('creates a bus', async () => {
    const bus = await createBus({
      busName: 'Sleeper 44',
      licensePlate: '47B-123.45',
      busType: 'SLEEPER',
      capacity: 44,
    })
    expect(bus.licensePlate).toBe('47B12345')
  })

  test('rejects a duplicate license plate', async () => {
    duplicatePlate = { id: busId }
    await expect(
      createBus({
        busName: 'Sleeper 44',
        licensePlate: '47B-123.45',
        busType: 'SLEEPER',
        capacity: 44,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  test('creates a seat', async () => {
    busFound.capacity = 3
    const seat = await addBusSeat(busId, { seatCode: 'B1', floor: 1 })
    expect(seat.seatCode).toBe('B1')
  })

  test('rejects a duplicate seat code', async () => {
    busFound.capacity = 3
    duplicateSeat = { id: randomUUID() }
    await expect(
      addBusSeat(busId, { seatCode: 'A1', floor: 1 }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('Prisma Trip transaction rules', () => {
  test('creates a trip through prisma.$transaction', async () => {
    const trip = await createTrip(tripPayload, adminId)
    expect(trip.id).toBe(tripId)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.trip.create).toHaveBeenCalledTimes(1)
  })

  test('creates one TripSeat for each ACTIVE seat', async () => {
    busFound.seats.push(makeSeat('A3', 'INACTIVE'))
    busFound.seats = busFound.seats.filter((seat) => seat.status === 'ACTIVE')
    await createTrip(tripPayload, adminId)
    const data = prisma.tripSeat.createMany.mock.calls[0][0].data
    expect(data).toHaveLength(2)
    expect(data.every((seat) => seat.status === 'AVAILABLE')).toBe(true)
  })

  test('rejects a trip when the bus has no ACTIVE seats', async () => {
    busFound.seats = []
    await expect(createTrip(tripPayload, adminId)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  test('rejects overlapping trips for the same bus', async () => {
    scheduleConflict = true
    await expect(createTrip(tripPayload, adminId)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  test('propagates TripSeat failure so transaction rolls back', async () => {
    tripSeatInsertError = new Error('simulated TripSeat failure')
    await expect(createTrip(tripPayload, adminId)).rejects.toThrow(
      'simulated TripSeat failure',
    )
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
