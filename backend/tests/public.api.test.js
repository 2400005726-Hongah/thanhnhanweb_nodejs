import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const departureLocationId = randomUUID()
const arrivalLocationId = randomUUID()
const tripId = randomUUID()

const getPublicLocations = jest.fn(async () => ({ locations: [] }))
const searchPublicTrips = jest.fn(async () => ({
  trips: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
}))
const getPublicTripDetail = jest.fn(async () => ({ trip: { id: tripId }, summary: {} }))
const getPublicTripSeats = jest.fn(async () => ({ trip: { id: tripId }, summary: {}, floors: [] }))

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: {} }))
jest.unstable_mockModule('../src/services/publicTrip.service.js', () => ({
  getPublicLocations,
  searchPublicTrips,
  getPublicTripDetail,
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

  test('searches trips with valid required queries', async () => {
    const response = await request(app).get('/api/v1/public/trips/search').query({
      departureLocationId,
      arrivalLocationId,
      departureDate: '2099-07-25',
    })
    expect(response.statusCode).toBe(200)
    expect(searchPublicTrips).toHaveBeenCalledTimes(1)
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

  test('returns trip detail and seat map', async () => {
    const [detailResponse, seatsResponse] = await Promise.all([
      request(app).get(`/api/v1/public/trips/${tripId}`),
      request(app).get(`/api/v1/public/trips/${tripId}/seats`),
    ])
    expect(detailResponse.statusCode).toBe(200)
    expect(seatsResponse.statusCode).toBe(200)
    expect(getPublicTripDetail).toHaveBeenCalledWith(tripId)
    expect(getPublicTripSeats).toHaveBeenCalledWith(tripId)
  })
})
