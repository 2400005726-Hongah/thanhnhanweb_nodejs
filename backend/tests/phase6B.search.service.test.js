import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const departureProvinceId = randomUUID()
const arrivalProvinceId = randomUUID()
const departureAreaId = randomUUID()
const arrivalAreaId = randomUUID()
const departureLocationId = randomUUID()
const arrivalLocationId = randomUUID()
const tripId = randomUUID()
const routeId = randomUUID()
const busId = randomUUID()

const departureLocation = {
  id: departureLocationId,
  name: 'Ea Tân',
  province: 'Đắk Lắk',
  address: 'Krông Năng',
}
const arrivalLocation = {
  id: arrivalLocationId,
  name: 'Bến xe An Sương',
  province: 'TP.HCM',
  address: 'Quận 12',
}
const trip = {
  id: tripId,
  departureTime: new Date('2099-07-25T12:00:00.000Z'),
  expectedArrivalTime: new Date('2099-07-25T20:00:00.000Z'),
  ticketPrice: 350000,
  singleRoomPrice: null,
  doubleRoomPrice: null,
  status: 'OPEN',
  salesStatus: 'OPEN',
  operationStatus: 'NOT_DEPARTED',
  departureLocation,
  arrivalLocation,
  route: {
    id: routeId,
    routeName: 'Đắk Lắk → TP.HCM',
    departureLocation,
    arrivalLocation,
    distanceKm: 380,
    estimatedDurationMinutes: 480,
    defaultTicketPrice: 350000,
    defaultSingleRoomPrice: null,
    defaultDoubleRoomPrice: null,
  },
  bus: {
    id: busId,
    busName: 'Xe giường nằm 34',
    licensePlate: '47B12345',
    busType: 'SLEEPER_34',
    capacity: 34,
  },
}

const prisma = {
  province: {
    findMany: jest.fn(async ({ where } = {}) => {
      if (where?.id?.in) {
        return where.id.in.map((id) => ({ id }))
      }
      return [
        {
          id: departureProvinceId,
          name: 'Đắk Lắk',
          areas: [{ id: departureAreaId, name: 'Krông Năng', sortOrder: 1 }],
        },
        {
          id: arrivalProvinceId,
          name: 'TP.HCM',
          areas: [{ id: arrivalAreaId, name: 'Quận 12', sortOrder: 1 }],
        },
      ]
    }),
  },
  pickupDropoffArea: {
    count: jest.fn(async ({ where }) => where.id.in.length),
  },
  location: {
    findMany: jest.fn(async () => []),
  },
  route: {
    findFirst: jest.fn(async () => null),
  },
  trip: {
    findMany: jest.fn(async () => [trip]),
  },
  tripSeat: {
    groupBy: jest.fn(async () => [{ tripId, _count: { _all: 7 } }]),
  },
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { getPublicTripSearchCatalog, searchPublicTrips } = await import(
  '../src/services/publicTrip.service.js'
)

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Giai đoạn 6B - tìm chuyến theo tỉnh/thành và bộ lọc khu vực', () => {
  test('trả danh mục tỉnh/thành đang hoạt động cùng bộ lọc theo thứ tự', async () => {
    const data = await getPublicTripSearchCatalog()

    expect(data.provinces).toHaveLength(2)
    expect(prisma.province.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      }),
    )
  })

  test('tìm theo tỉnh/thành không còn bắt buộc route exact giữa hai location', async () => {
    const data = await searchPublicTrips({
      departureProvinceId,
      arrivalProvinceId,
      departureDate: '2099-07-25',
      page: 1,
      limit: 10,
    })

    expect(prisma.route.findFirst).not.toHaveBeenCalled()
    expect(data.trips).toHaveLength(1)
    expect(data.trips[0]).toMatchObject({
      availableSeatCount: 7,
      route: {
        departureLocation: { id: departureLocationId, name: 'Ea Tân' },
        arrivalLocation: { id: arrivalLocationId, name: 'Bến xe An Sương' },
      },
    })
  })

  test('lọc điểm đi/đến chỉ bằng bộ lọc duy nhất defaultAreaId của địa điểm cụ thể', async () => {
    await searchPublicTrips({
      departureProvinceId,
      arrivalProvinceId,
      departureAreaIds: departureAreaId,
      arrivalAreaIds: arrivalAreaId,
      departureDate: '2099-07-25',
      page: 1,
      limit: 10,
    })

    const where = prisma.trip.findMany.mock.calls[0][0].where
    expect(where.status).toBe('OPEN')
    expect(where.salesStatus).toBe('OPEN')
    expect(where.operationStatus).toBe('NOT_DEPARTED')
    expect(JSON.stringify(where)).toContain(departureAreaId)
    expect(JSON.stringify(where)).toContain(arrivalAreaId)
    expect(JSON.stringify(where)).toContain('defaultAreaId')
    expect(JSON.stringify(where)).not.toContain('areaFilters')
  })

  test('kiểm tra bộ lọc khu vực phải thuộc đúng tỉnh/thành', async () => {
    prisma.pickupDropoffArea.count.mockResolvedValueOnce(0)

    await expect(
      searchPublicTrips({
        departureProvinceId,
        arrivalProvinceId,
        departureAreaIds: departureAreaId,
        departureDate: '2099-07-25',
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
