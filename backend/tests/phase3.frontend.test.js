import { readFile } from 'node:fs/promises'

const seatMapPath = new URL(
  '../../frontend/src/components/seats/SeatMap.jsx',
  import.meta.url,
)
const tripCardPath = new URL(
  '../../frontend/src/components/search/TripCard.jsx',
  import.meta.url,
)
const adminBusesPath = new URL(
  '../../frontend/src/pages/admin/AdminBusesPage.jsx',
  import.meta.url,
)
const adminTripsPath = new URL(
  '../../frontend/src/pages/admin/AdminTripsRoutesPage.jsx',
  import.meta.url,
)

const [seatMap, tripCard, adminBuses, adminTrips] = await Promise.all([
  readFile(seatMapPath, 'utf8'),
  readFile(tripCardPath, 'utf8'),
  readFile(adminBusesPath, 'utf8'),
  readFile(adminTripsPath, 'utf8'),
])

describe('Phase 3 frontend bus and pricing views', () => {
  test('selects a distinct seat layout from the API busType', () => {
    expect(seatMap).toContain('isRoomBusType(busType)')
    expect(seatMap).toContain("seat-map--${roomBus ? 'rooms-22' : 'sleeper-34'}")
    expect(seatMap).toContain('Phòng đơn')
    expect(seatMap).toContain('Phòng đôi')
  })

  test('shows separate limousine room prices in public search', () => {
    expect(tripCard).toContain('trip.singleRoomPrice')
    expect(tripCard).toContain('trip.doubleRoomPrice')
    expect(tripCard).toContain('trip.availableSeatCount')
  })

  test('admin identifies vehicles by license plate and standard vehicle type, without a separate vehicle name', () => {
    expect(adminBuses).toContain('value="SLEEPER_34"')
    expect(adminBuses).toContain('value="LIMOUSINE_22"')
    expect(adminBuses).toContain('Số ghế/phòng')
    expect(adminBuses).toContain('Tìm theo biển số xe...')
    expect(adminBuses).not.toContain('<span>Tên xe</span>')
    expect(adminBuses).not.toContain('name="busName"')
    expect(adminBuses).not.toContain('Array.from({ length: capacity }')
  })

  test('admin trip form owns sleeper/room prices without route default prices', () => {
    expect(adminTrips).toContain('singleRoomPrice')
    expect(adminTrips).toContain('doubleRoomPrice')
    expect(adminTrips).toContain('Giá phòng đơn')
    expect(adminTrips).toContain('Giá phòng đôi')
    expect(adminTrips).not.toContain('defaultSingleRoomPrice')
    expect(adminTrips).not.toContain('defaultDoubleRoomPrice')
    expect(adminTrips).toContain('trip.seatStats?.held')
  })
})
