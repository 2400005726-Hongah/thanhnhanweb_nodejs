import { randomUUID } from 'node:crypto'

import { jest } from '@jest/globals'
import jwt from 'jsonwebtoken'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.JWT_EXPIRES_IN = '1h'

const admin = {
  id: randomUUID(),
  fullName: 'Chủ xe',
  email: 'owner@example.com',
  phone: '0987654321',
  role: 'ADMIN',
  status: 'ACTIVE',
}
const staff = {
  id: randomUUID(),
  fullName: 'Nhân viên',
  email: 'staff@example.com',
  phone: '0977777777',
  role: 'STAFF',
  status: 'ACTIVE',
}
const customer = {
  id: randomUUID(),
  fullName: 'Khách hàng',
  email: 'customer@example.com',
  phone: '0966666666',
  role: 'CUSTOMER',
  status: 'ACTIVE',
}
const routeId = randomUUID()
const tripId = randomUUID()
const busId = randomUUID()
const newsId = randomUUID()
const locationA = randomUUID()
const locationB = randomUUID()

const users = new Map([
  [admin.id, admin],
  [staff.id, staff],
  [customer.id, customer],
])

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }) => users.get(where.id) || null),
  },
}

const tripService = {
  getTrips: jest.fn(async () => ({ trips: [], pagination: {} })),
  getTripById: jest.fn(async () => ({ id: tripId })),
  createTrip: jest.fn(async () => ({ id: tripId })),
  updateTrip: jest.fn(async () => ({ id: tripId })),
  changeTripStatus: jest.fn(async () => ({ id: tripId })),
  cancelTrip: jest.fn(async () => ({ id: tripId, status: 'CANCELLED' })),
}
const routeService = {
  getRoutes: jest.fn(async () => ({ routes: [], pagination: {} })),
  getRouteById: jest.fn(async () => ({ id: routeId })),
  createRoute: jest.fn(async () => ({ id: routeId })),
  updateRoute: jest.fn(async () => ({ id: routeId })),
  deactivateRoute: jest.fn(async () => ({ id: routeId, status: 'INACTIVE' })),
}
const newsService = {
  NEWS_STATUSES: ['ACTIVE', 'INACTIVE', 'DRAFT', 'PUBLISHED'],
  listNews: jest.fn(async () => ({ news: [], pagination: {} })),
  getNewsById: jest.fn(async () => ({ id: newsId })),
  createNews: jest.fn(async () => ({ id: newsId })),
  updateNews: jest.fn(async () => ({ id: newsId })),
  changeNewsStatus: jest.fn(async () => ({ id: newsId })),
  softDeleteNews: jest.fn(async () => ({ id: newsId, status: 'INACTIVE' })),
}
const busService = {
  getBuses: jest.fn(async () => ({ buses: [], pagination: {} })),
  getBusById: jest.fn(async () => ({ id: busId })),
  getBusSeats: jest.fn(async () => ({ seats: [] })),
  createBus: jest.fn(),
  updateBus: jest.fn(),
  deactivateBus: jest.fn(),
  addBusSeat: jest.fn(),
  updateBusSeat: jest.fn(),
  deactivateBusSeat: jest.fn(),
}
const adminService = {
  getDashboardSummary: jest.fn(async (role) => ({ role })),
  getRevenueSummary: jest.fn(async () => ({ revenue: 1000 })),
  listManagedBookings: jest.fn(async () => ({ bookings: [], pagination: {} })),
  getManagedBooking: jest.fn(async () => ({ bookingCode: 'TN-ABC12345' })),
  updateBookingContact: jest.fn(),
  markBookingNoShow: jest.fn(),
  listCustomers: jest.fn(async () => ({ customers: [], pagination: {} })),
  listUsers: jest.fn(async () => ({ users: [], pagination: {} })),
  createManagedUser: jest.fn(async () => ({ id: randomUUID() })),
  changeUserStatus: jest.fn(),
  changeUserRole: jest.fn(),
  updateCustomer: jest.fn(),
  listAuditLogs: jest.fn(async () => ({ logs: [], pagination: {} })),
}
const cancelManagedBooking = jest.fn(async ({ bookingCode, reason }) => ({
  bookingCode,
  reason,
  status: 'CANCELLED',
}))

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))
jest.unstable_mockModule('../src/services/trip.service.js', () => tripService)
jest.unstable_mockModule('../src/services/route.service.js', () => routeService)
jest.unstable_mockModule('../src/services/news.service.js', () => newsService)
jest.unstable_mockModule('../src/services/bus.service.js', () => busService)
jest.unstable_mockModule('../src/services/admin.service.js', () => adminService)
jest.unstable_mockModule('../src/services/cancellation.service.js', () => ({
  cancelManagedBooking,
  cancelBooking: jest.fn(),
  getCancellationState: jest.fn(() => ({ canCancel: false })),
}))

const { default: app } = await import('../src/app.js')

const tokenFor = (user) =>
  jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  })

const adminToken = tokenFor(admin)
const staffToken = tokenFor(staff)
const customerToken = tokenFor(customer)

beforeEach(() => {
  jest.clearAllMocks()
})

describe('STAFF operation permissions', () => {
  test('STAFF lists separate Customer profiles instead of CUSTOMER accounts', async () => {
    const response = await request(app)
      .get('/api/v1/admin/customers?status=ACTIVE')
      .set('Authorization', `Bearer ${staffToken}`)

    expect(response.statusCode).toBe(200)
    expect(adminService.listCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    )
    expect(adminService.listUsers).not.toHaveBeenCalled()
  })

  test('STAFF cancellation requires and forwards a reason', async () => {
    const bookingCode = 'TNABCDEF1234567890'
    const missingReason = await request(app)
      .post(`/api/v1/admin/bookings/${bookingCode}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)

    expect(missingReason.statusCode).toBe(400)
    expect(cancelManagedBooking).not.toHaveBeenCalled()

    const response = await request(app)
      .post(`/api/v1/admin/bookings/${bookingCode}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Khách thay đổi kế hoạch' })

    expect(response.statusCode).toBe(200)
    expect(cancelManagedBooking).toHaveBeenCalledWith({
      bookingCode,
      actor: expect.objectContaining({ id: staff.id, role: 'STAFF' }),
      reason: 'Khách thay đổi kế hoạch',
    })
  })

  test('STAFF views and edits trips, but cannot create or delete trips', async () => {
    const [list, edit, create, remove] = await Promise.all([
      request(app)
        .get('/api/v1/trips?status=COMPLETED')
        .set('Authorization', `Bearer ${staffToken}`),
      request(app)
        .patch(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ ticketPrice: 250000 }),
      request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({}),
      request(app)
        .delete(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${staffToken}`),
    ])

    expect(list.statusCode).toBe(200)
    expect(edit.statusCode).toBe(200)
    expect(create.statusCode).toBe(403)
    expect(remove.statusCode).toBe(403)
    expect(tripService.getTrips).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: true }),
    )
  })

  test('STAFF views and edits routes, but cannot create or delete routes', async () => {
    const [list, edit, create, remove] = await Promise.all([
      request(app)
        .get('/api/v1/routes?status=INACTIVE')
        .set('Authorization', `Bearer ${staffToken}`),
      request(app)
        .patch(`/api/v1/routes/${routeId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ routeName: 'Tuyến đã cập nhật' }),
      request(app)
        .post('/api/v1/routes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({}),
      request(app)
        .delete(`/api/v1/routes/${routeId}`)
        .set('Authorization', `Bearer ${staffToken}`),
    ])

    expect(list.statusCode).toBe(200)
    expect(edit.statusCode).toBe(200)
    expect(create.statusCode).toBe(403)
    expect(remove.statusCode).toBe(403)
    expect(routeService.getRoutes).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: true }),
    )
  })

  test('STAFF manages news including publish and soft delete', async () => {
    const responses = await Promise.all([
      request(app)
        .get('/api/v1/admin/news')
        .set('Authorization', `Bearer ${staffToken}`),
      request(app)
        .post('/api/v1/admin/news')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: 'Tin mới', content: 'Nội dung tin mới' }),
      request(app)
        .patch(`/api/v1/admin/news/${newsId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: 'Tin đã sửa' }),
      request(app)
        .patch(`/api/v1/admin/news/${newsId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PUBLISHED' }),
      request(app)
        .delete(`/api/v1/admin/news/${newsId}`)
        .set('Authorization', `Bearer ${staffToken}`),
    ])

    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 201, 200, 200, 200,
    ])
    expect(newsService.softDeleteNews).toHaveBeenCalled()
  })

  test('STAFF views buses but cannot manage buses or seat structure', async () => {
    const [list, create, addSeat] = await Promise.all([
      request(app)
        .get('/api/v1/buses')
        .set('Authorization', `Bearer ${staffToken}`),
      request(app)
        .post('/api/v1/buses')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({}),
      request(app)
        .post(`/api/v1/buses/${busId}/seats`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({}),
    ])
    expect(list.statusCode).toBe(200)
    expect(create.statusCode).toBe(403)
    expect(addSeat.statusCode).toBe(403)
  })

  test('STAFF cannot access revenue, user management, or audit logs', async () => {
    const responses = await Promise.all([
      request(app)
        .get('/api/v1/admin/revenue/summary')
        .set('Authorization', `Bearer ${staffToken}`),
      request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${staffToken}`),
      request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${staffToken}`),
    ])
    expect(responses.map((response) => response.statusCode)).toEqual([
      403, 403, 403,
    ])
  })
})

describe('ADMIN and CUSTOMER permission boundaries', () => {
  test('ADMIN can create/delete trips and routes and view sensitive pages', async () => {
    const future = new Date(Date.now() + 86_400_000)
    const later = new Date(future.getTime() + 3_600_000)
    const responses = await Promise.all([
      request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          route: routeId,
          bus: busId,
          departureTime: future.toISOString(),
          expectedArrivalTime: later.toISOString(),
          ticketPrice: 250000,
        }),
      request(app)
        .delete(`/api/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .post('/api/v1/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          routeName: 'Tuyến mới',
          departureLocation: locationA,
          arrivalLocation: locationB,
          distanceKm: 100,
          estimatedDurationMinutes: 180,
        }),
      request(app)
        .delete(`/api/v1/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/admin/revenue/summary')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`),
    ])
    expect(responses.map((response) => response.statusCode)).toEqual([
      201, 200, 201, 200, 200, 200, 200,
    ])
  })

  test('CUSTOMER cannot use operation dashboard', async () => {
    const response = await request(app)
      .get('/api/v1/admin/dashboard/summary')
      .set('Authorization', `Bearer ${customerToken}`)
    expect(response.statusCode).toBe(403)
  })
})
