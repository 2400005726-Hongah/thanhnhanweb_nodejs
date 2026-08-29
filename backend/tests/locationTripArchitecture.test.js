import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8')

const files = {}

beforeAll(async () => {
  Object.assign(files, {
    schema: await read('prisma/schema.prisma'),
    migration: await read(
      'prisma/migrations/20260811000200_location_master_trip_direct/migration.sql',
    ),
    locationService: await read('src/services/locationHierarchy.service.js'),
    locationValidator: await read('src/validators/locationHierarchy.validator.js'),
    tripService: await read('src/services/trip.service.js'),
    tripValidator: await read('src/validators/trip.validator.js'),
    publicService: await read('src/services/publicTrip.service.js'),
    routeService: await read('src/services/route.service.js'),
    routeRoutes: await read('src/routes/route.routes.js'),
    locationRoutes: await read('src/routes/location.routes.js'),
    tripRoutes: await read('src/routes/trip.routes.js'),
    app: await read('../frontend/src/App.jsx'),
    adminLocations: await read('../frontend/src/pages/admin/AdminLocationsPage.jsx'),
    adminTrips: await read('../frontend/src/pages/admin/AdminTripsRoutesPage.jsx'),
    adminRoutes: await read('../frontend/src/pages/admin/AdminRoutesSummaryPage.jsx'),
    searchTrips: await read('../frontend/src/pages/SearchTripsPage.jsx'),
    packageJson: await read('package.json'),
    prismaSeed: await read('prisma/seed.js'),
    bookingExcel: await read('src/services/bookingExcel.service.js'),
  })
})

describe('Kiến trúc mới Địa điểm → Chuyến xe → Tìm chuyến', () => {
  test('giữ Route legacy nhưng Trip không còn bắt buộc routeId', () => {
    expect(files.schema).toMatch(/routeId\s+String\?\s+@map\("route_id"\)/)
    expect(files.schema).toMatch(/route\s+Route\?\s+@relation\(fields: \[routeId\]/)
    expect(files.migration).toContain('ALTER COLUMN "route_id" DROP NOT NULL')
    expect(files.migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i)
  })

  test('địa điểm cụ thể dùng một tỉnh, nhiều bộ lọc áp dụng, một bộ lọc mặc định và một loại sử dụng', () => {
    expect(files.schema).toContain('provinceId')
    expect(files.schema).toContain('defaultAreaId')
    expect(files.schema).toContain('locationType')
    expect(files.schema).toContain('LocationAreaFilter')
    expect(files.locationValidator).toContain("body('defaultAreaId')")
    expect(files.locationValidator).toContain("body('filterAreaIds')")
    expect(files.locationValidator).toContain("body('filterAreaIds.*')")
    expect(files.locationValidator).toContain(".isIn(['PICKUP', 'DROPOFF', 'BOTH'])")
    expect(files.locationService).toContain('...(payload.filterAreaIds || [])')
    expect(files.locationService).toContain('locationAreaFilter.createMany')
    expect(files.locationService).toContain('isDeleted: false')
  })

  test('chống trùng địa điểm cụ thể theo tỉnh bằng tên đã chuẩn hóa', () => {
    expect(files.locationService).toContain('normalizeComparisonKey(name)')
    expect(files.locationService).toContain('provinceId: province.id, normalizedName')
    expect(files.locationService).toContain(
      'Địa điểm cụ thể này đã tồn tại trong tỉnh/thành đã chọn.',
    )
  })

  test('chuyến xe chọn trực tiếp tỉnh và địa điểm cụ thể, không bắt buộc Tuyến xe', () => {
    for (const field of [
      'departureProvinceId',
      'departureLocationId',
      'arrivalProvinceId',
      'arrivalLocationId',
    ]) {
      expect(files.tripValidator).toContain(`body('${field}')`)
      expect(files.adminTrips).toContain(`name="${field}"`)
    }
    expect(files.tripValidator).toContain("body('route').optional")
    expect(files.adminTrips).not.toContain('name="route"')
    expect(files.tripService).toContain("['PICKUP', 'BOTH']")
    expect(files.tripService).toContain("['DROPOFF', 'BOTH']")
    expect(files.tripService).toContain('Tỉnh/Thành đi phải khác Tỉnh/Thành đến')
  })

  test('tìm chuyến theo tỉnh và bộ lọc chính của địa điểm, không dùng quan hệ nhiều-nhiều', () => {
    expect(files.publicService).toContain('departureProvinceId')
    expect(files.publicService).toContain('arrivalProvinceId')
    expect(files.publicService).toContain('defaultAreaId: { in: areaIds }')
    expect(files.publicService).toContain("usageType === 'PICKUP'")
    expect(files.publicService).toContain("usageType === 'DROPOFF'")
    expect(files.publicService).not.toContain('areaFilters')
    expect(files.searchTrips).toContain('departureAreaIds')
    expect(files.searchTrips).toContain('arrivalAreaIds')
  })

  test('các đầu ra quản trị tiếp tục hiển thị hành trình khi chuyến mới không có routeId', () => {
    expect(files.bookingExcel).toContain("getTripJourneyName")
    expect(files.bookingExcel).not.toContain("booking.trip?.route?.routeName || ''")
  })

  test('trang Tuyến xe chỉ tổng hợp từ các chuyến thực tế', () => {
    expect(files.routeService).toContain('const getRouteSummary = async () =>')
    expect(files.routeService).toContain('const key = `${departure.id}:${arrival.id}`')
    expect(files.routeService).toContain('tripCount: 0')
    expect(files.routeRoutes).toContain("'/summary'")
    expect(files.app).toContain('path="tuyen-xe"')
    expect(files.adminRoutes).toContain('Các tuyến xe đang khai thác')
    expect(files.adminRoutes).toContain('getRouteSummary')
    expect(files.adminRoutes).not.toContain('+ Thêm tuyến đường')
  })

  test('giao diện Địa điểm hỗ trợ nhiều bộ lọc áp dụng và một bộ lọc mặc định', () => {
    expect(files.adminLocations).toContain('Bộ lọc áp dụng')
    expect(files.adminLocations).toContain('Bộ lọc mặc định')
    expect(files.adminLocations).toContain('filterAreaIds')
    expect(files.adminLocations).toContain('Loại địa điểm')
    expect(files.adminLocations).toContain('Địa chỉ chi tiết')
    expect(files.adminLocations).toContain('Xóa mềm')
  })


  test('API tuyến legacy vẫn khóa ghi nhưng điểm đón/trả phục vụ được cấu hình riêng theo chuyến', () => {
    expect(files.routeRoutes).toContain('status(410)')
    expect(files.locationRoutes).toContain('status(410)')
    expect(files.routeRoutes).toContain('Tuyến xe hiện được tổng hợp tự động từ các Chuyến xe')
    expect(files.locationRoutes).toContain('/locations/specific')
    expect(files.tripRoutes).toContain("'/:id/service-points'")
    expect(files.tripRoutes).toContain('updateTripServicePoints')
    expect(files.tripRoutes).not.toContain('Cấu hình điểm phục vụ chuyến kiểu cũ đã ngừng sử dụng')
  })

  test('Prisma seed mặc định chỉ nhắc nhập dữ liệu thủ công, không tự tạo tuyến/chuyến demo legacy', () => {
    expect(files.packageJson).toContain('"db:seed": "prisma db seed"')
    expect(files.packageJson).toContain('"seed:data": "node src/jobs/seedData.js"')
    expect(files.prismaSeed).toContain('printManualDataNotice')
    expect(files.prismaSeed).not.toContain('seedOperationalData')
  })

  test('bỏ cấu hình điểm dừng theo Tuyến; cấu hình điểm đón/trả theo Chuyến vẫn được giữ để chỉnh cùng dữ liệu', () => {
    expect(files.app).not.toContain('AdminRouteStopsPage')
    expect(files.app).not.toContain('tuyen-duong/:routeId/diem-dung')
    expect(files.app).toContain('AdminTripServicePointsPage')
    expect(files.app).toContain('chuyen-xe/:tripId/diem-don-tra')
    expect(files.adminTrips).toContain('configureTripServicePoints')
    expect(files.adminTrips).toContain('servicePoints')
  })
})
