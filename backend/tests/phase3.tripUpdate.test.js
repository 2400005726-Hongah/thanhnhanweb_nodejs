import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

const tripId = randomUUID()
const routeId = randomUUID()
const busId = randomUUID()
const otherBusId = randomUUID()
const departureLocationId = randomUUID()
const arrivalLocationId = randomUUID()
const departureProvinceId = randomUUID()
const arrivalProvinceId = randomUUID()
const departureAreaId = randomUUID()
const arrivalAreaId = randomUUID()
const trip = {
  id: tripId,
  routeId,
  busId,
  departureTime: new Date('2099-08-01T01:00:00.000Z'),
  expectedArrivalTime: new Date('2099-08-01T09:00:00.000Z'),
  ticketPrice: 250000,
  singleRoomPrice: null,
  doubleRoomPrice: null,
  status: 'OPEN',
  departureLocationId,
  arrivalLocationId,
}

let protectedSeatCount

const transaction = {
  trip: {
    findUnique: jest.fn(async () => trip),
    findFirst: jest.fn(async () => null),
    update: jest.fn(async ({ data }) => ({
      ...trip,
      ...data,
      route: { id: routeId },
      bus: { id: busId, busType: 'SLEEPER', capacity: 44 },
    })),
  },
  route: {
    findFirst: jest.fn(async () => ({
      id: routeId,
      status: 'ACTIVE',
      departureLocationId,
      arrivalLocationId,
      defaultTicketPrice: 240000,
    })),
  },
  location: {
    findMany: jest.fn(async () => [
      { id: departureLocationId, provinceId: departureProvinceId, defaultAreaId: departureAreaId, name: 'Điểm đi', locationType: 'BOTH', status: 'ACTIVE' },
      { id: arrivalLocationId, provinceId: arrivalProvinceId, defaultAreaId: arrivalAreaId, name: 'Điểm đến', locationType: 'BOTH', status: 'ACTIVE' },
    ]),
  },
  bus: {
    findFirst: jest.fn(async ({ where }) => ({
      id: where.id,
      busType: 'SLEEPER',
      capacity: 44,
      status: 'ACTIVE',
      seats: [
        {
          id: randomUUID(),
          seatCode: 'A01',
          floor: 1,
          seatType: 'NORMAL',
          status: 'ACTIVE',
        },
      ],
    })),
  },
  tripSeat: {
    count: jest.fn(async () => protectedSeatCount),
    updateMany: jest.fn(async () => ({ count: 1 })),
    deleteMany: jest.fn(async () => ({ count: 1 })),
    createMany: jest.fn(async () => ({ count: 1 })),
  },
  bookingItem: {
    count: jest.fn(async () => 0),
  },
}

const prisma = {
  $transaction: jest.fn(async (callback) => callback(transaction)),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { updateTrip } = await import('../src/services/trip.service.js')

beforeEach(() => {
  protectedSeatCount = 0
  jest.clearAllMocks()
})

describe('Phase 3 safe trip updates', () => {
  test('updates prices only on AVAILABLE TripSeat snapshots', async () => {
    await updateTrip(tripId, { ticketPrice: 310000 })

    expect(transaction.tripSeat.updateMany).toHaveBeenCalledTimes(3)
    for (const [argument] of transaction.tripSeat.updateMany.mock.calls) {
      expect(argument.where).toEqual(
        expect.objectContaining({
          tripId,
          status: 'AVAILABLE',
        }),
      )
    }
  })

  test('does not change bus when a seat is HELD or BOOKED', async () => {
    protectedSeatCount = 1

    await expect(
      updateTrip(tripId, { bus: otherBusId }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.tripSeat.deleteMany).not.toHaveBeenCalled()
    expect(transaction.trip.update).not.toHaveBeenCalled()
  })

  test('does not change bus when an historical BookingItem still exists', async () => {
    transaction.bookingItem.count.mockResolvedValueOnce(1)

    await expect(
      updateTrip(tripId, { bus: otherBusId }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(transaction.tripSeat.deleteMany).not.toHaveBeenCalled()
  })
})
