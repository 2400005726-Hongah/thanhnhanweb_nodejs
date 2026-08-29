import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const departureLocationId = randomUUID()
const arrivalLocationId = randomUUID()
const tripId = randomUUID()
const departureProvinceId = randomUUID()
const arrivalProvinceId = randomUUID()

const getPublicLocations = jest.fn(async () => ({ locations: [] }))
const getPublicTripSearchCatalog = jest.fn(async () => ({ provinces: [] }))
const searchPublicTrips = jest.fn(async () => ({
  trips: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
}))
const getPublicTripDetail = jest.fn(async () => ({ trip: { id: tripId }, summary: {} }))
const getPublicTripServicePoints = jest.fn(async () => ({
  trip: { id: tripId },
  pickupPoints: [],
  dropoffPoints: [],
}))
const getPublicTripSeats = jest.fn(async () => ({ trip: { id: tripId }, summary: {}, floors: [] }))

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: {} }))
jest.unstable_mockModule('../src/services/publicTrip.service.js', () => ({
  getPublicLocations,
  getPublicTripSearchCatalog,
  searchPublicTrips,
  getPublicTripDetail,
  getPublicTripServicePoints,
  getPublicTripSeats,
}))

const { default: app } = await import('../src/app.js')

beforeEach(() => jest.clearAllMocks())

describe('Public trip API validation and responses', () => {
  test('returns public active location payload without authentication', async () => {
    const response = await request(app).get('/api/v1/public/locations')
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)
    expect(getPublicLocations).toHaveBeenCalledTimes(1)
  })

  test('returns active province and area catalog for trip search', async () => {
    const response = await request(app).get('/api/v1/public/search/catalog')
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)
    expect(getPublicTripSearchCatalog).toHaveBeenCalledTimes(1)
  })

  test('searches trips with valid required queries', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureLocationId,
      arrivalLocationId,
      departureDate: '2099-07-25',
    })
    expect(response.statusCode).toBe(200)
    expect(searchPublicTrips).toHaveBeenCalledTimes(1)
  })

  test('searches trips by province pair like MVC', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureProvinceId,
      arrivalProvinceId,
      departureDate: '2099-07-25',
    })

    expect(response.statusCode).toBe(200)
    expect(searchPublicTrips).toHaveBeenCalledWith(
      expect.objectContaining({ departureProvinceId, arrivalProvinceId }),
    )
  })

  test('rejects equal departure and arrival provinces', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureProvinceId,
      arrivalProvinceId: departureProvinceId,
      departureDate: '2099-07-25',
    })
    expect(response.statusCode).toBe(400)
  })

  test('accepts Phase 3 bus type filters', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureLocationId,
      arrivalLocationId,
      departureDate: '2099-07-25',
      busType: 'LIMOUSINE_22',
    })

    expect(response.statusCode).toBe(200)
    expect(searchPublicTrips).toHaveBeenCalledWith(
      expect.objectContaining({ busType: 'LIMOUSINE_22' }),
    )
  })

  test('rejects missing search queries', async () => {
    const response = await request(app).get('/api/v1/public/trips/search')
    expect(response.statusCode).toBe(400)
    expect(searchPublicTrips).not.toHaveBeenCalled()
  })

  test('rejects equal departure and arrival locations', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureLocationId,
      arrivalLocationId: departureLocationId,
      departureDate: '2099-07-25',
    })
    expect(response.statusCode).toBe(400)
  })

  test('rejects invalid UUID and invalid date', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureLocationId: 'invalid',
      arrivalLocationId,
      departureDate: '2099-02-31',
    })
    expect(response.statusCode).toBe(400)
  })

  test('returns trip detail, service points and seat map', async () => {
    const [detailResponse, servicePointResponse, seatsResponse] = await Promise.all([
      request(app).get(`/api/v1/public/trips/${tripId}`),
      request(app).get(`/api/v1/public/trips/${tripId}/service-points`),
      request(app).get(`/api/v1/public/trips/${tripId}/seats`),
    ])
    expect(detailResponse.statusCode).toBe(200)
    expect(servicePointResponse.statusCode).toBe(200)
    expect(seatsResponse.statusCode).toBe(200)
    expect(getPublicTripDetail).toHaveBeenCalledWith(tripId)
    expect(getPublicTripServicePoints).toHaveBeenCalledWith(tripId)
    expect(getPublicTripSeats).toHaveBeenCalledWith(tripId)
  })
})
