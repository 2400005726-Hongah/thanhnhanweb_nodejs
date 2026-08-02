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

  test('admin creates only server-managed 34/22 bus types', () => {
    expect(adminBuses).toContain('value="SLEEPER_34"')
    expect(adminBuses).toContain('value="LIMOUSINE_22"')
    expect(adminBuses).not.toContain('Array.from({ length: capacity }')
  })

  test('admin trip and route forms support sleeper and room prices', () => {
    expect(adminTrips).toContain('singleRoomPrice')
    expect(adminTrips).toContain('doubleRoomPrice')
    expect(adminTrips).toContain('defaultSingleRoomPrice')
    expect(adminTrips).toContain('defaultDoubleRoomPrice')
    expect(adminTrips).toContain("'Giá phòng đơn mặc định (để trống nếu chưa cấu hình):'")
    expect(adminTrips).toContain("'Giá phòng đôi mặc định (để trống nếu chưa cấu hình):'")
    expect(adminTrips).toContain('trip.seatStats?.held')
  })
})
