import { readFile } from 'node:fs/promises'

const appPath = new URL('../../frontend/src/App.jsx', import.meta.url)
const adminBookingPath = new URL(
  '../../frontend/src/pages/admin/AdminBookingCreatePage.jsx',
  import.meta.url,
)
const adminTripsPath = new URL(
  '../../frontend/src/pages/admin/AdminTripsRoutesPage.jsx',
  import.meta.url,
)
const onlineBookingPath = new URL(
  '../../frontend/src/pages/BookingPage.jsx',
  import.meta.url,
)

const [app, adminBooking, adminTrips, onlineBooking] = await Promise.all([
  readFile(appPath, 'utf8'),
  readFile(adminBookingPath, 'utf8'),
  readFile(adminTripsPath, 'utf8'),
  readFile(onlineBookingPath, 'utf8'),
])

describe('Phase 4 booking frontend routes and payload ownership', () => {
  test('uses separate protected Hotline and Counter routes', () => {
    expect(app).toContain('path="dat-ve-hotline/:tripId"')
    expect(app).toContain('path="dat-ve-tai-quay/:tripId"')
    expect(app).toContain('source="HOTLINE"')
    expect(app).toContain('source="COUNTER"')
    expect(app).toContain('PERMISSIONS.MANAGE_BOOKINGS')
    expect(adminTrips).toContain('/admin/dat-ve-hotline/${trip.id}')
    expect(adminTrips).toContain('/admin/dat-ve-tai-quay/${trip.id}')
  })

  test('managed form sends seat IDs and notes but no trusted actor or price fields', () => {
    expect(adminBooking).toContain('tripSeatIds: [...selected.keys()]')
    expect(adminBooking).toContain('customerNote: customerNote.trim()')
    expect(adminBooking).toContain('staffNote: staffNote.trim()')
    expect(adminBooking).not.toContain('createdById:')
    expect(adminBooking).not.toContain('totalAmount:')
  })

  test('Online booking requires email and does not send source or staff fields', () => {
    expect(onlineBooking).toContain("if (!passenger.email.trim())")
    expect(onlineBooking).toMatch(/id="email"[\s\S]*required/)
    expect(onlineBooking).not.toContain('source:')
    expect(onlineBooking).not.toContain('createdById:')
    expect(onlineBooking).not.toContain('staffNote:')
  })
})
