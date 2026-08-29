import { readFile } from 'node:fs/promises'

const appPath = new URL('../../frontend/src/App.jsx', import.meta.url)
const layoutPath = new URL('../../frontend/src/layouts/AdminLayout.jsx', import.meta.url)
const locationsPath = new URL(
  '../../frontend/src/pages/admin/AdminLocationsPage.jsx',
  import.meta.url,
)
const tripsRoutesPath = new URL(
  '../../frontend/src/pages/admin/AdminTripsRoutesPage.jsx',
  import.meta.url,
)
const routeSummaryPath = new URL(
  '../../frontend/src/pages/admin/AdminRoutesSummaryPage.jsx',
  import.meta.url,
)
const adminServicePath = new URL(
  '../../frontend/src/services/admin.service.js',
  import.meta.url,
)
const routeApiPath = new URL('../src/routes/route.routes.js', import.meta.url)

const [app, layout, locations, tripsRoutes, routeSummary, adminService, routeApi] = await Promise.all([
  readFile(appPath, 'utf8'),
  readFile(layoutPath, 'utf8'),
  readFile(locationsPath, 'utf8'),
  readFile(tripsRoutesPath, 'utf8'),
  readFile(routeSummaryPath, 'utf8'),
  readFile(adminServicePath, 'utf8'),
  readFile(routeApiPath, 'utf8'),
])

describe('Kiến trúc địa điểm / chuyến mới trên frontend quản trị', () => {
  test('STAFF quản lý danh mục địa điểm bằng quyền sửa tuyến hiện có', () => {
    expect(layout).toContain("label: 'Địa điểm'")
    expect(layout).toContain('PERMISSIONS.EDIT_ROUTES')
    expect(app).toContain('requiredPermissions={[PERMISSIONS.EDIT_ROUTES]}')
  })

  test('Địa điểm gồm tỉnh/thành, nhiều bộ lọc áp dụng, bộ lọc mặc định và xóa mềm', () => {
    expect(locations).toContain('Quản lý tỉnh/thành và địa điểm')
    expect(locations).toContain('Danh sách tỉnh/thành')
    expect(locations).toContain('Bộ lọc địa điểm')
    expect(locations).toContain('Địa điểm cụ thể')
    expect(locations).toContain('Bộ lọc áp dụng')
    expect(locations).toContain('Bộ lọc mặc định')
    expect(locations).toContain('Cả điểm đón và điểm trả')
    expect(locations).toContain('filterAreaIds')
    expect(locations).toContain('sortOrder')
    expect(locations).toContain('Xóa')
  })

  test('frontend có API danh mục và API danh sách địa điểm cụ thể theo tỉnh/loại', () => {
    expect(adminService).toContain("'/locations/catalog'")
    expect(adminService).toContain("'/locations/provinces'")
    expect(adminService).toContain("'/locations/areas'")
    expect(adminService).toContain("'/locations/specific'")
    expect(adminService).toContain('getSpecificLocations')
  })

  test('không dùng cấu hình điểm dừng tuyến cũ nhưng vẫn hỗ trợ cấu hình điểm đón/trả theo chuyến', () => {
    expect(app).not.toContain('path="tuyen-duong/:routeId/diem-dung"')
    expect(app).toContain('path="chuyen-xe/:tripId/diem-don-tra"')
    expect(tripsRoutes).toContain('configureTripServicePoints')
    expect(tripsRoutes).toContain('primaryPickupMode')
    expect(tripsRoutes).toContain('primaryDropoffMode')
  })

  test('form chuyến chọn tỉnh/thành và địa điểm cụ thể trực tiếp, không chọn route', () => {
    expect(tripsRoutes).toContain('Tỉnh/Thành đi')
    expect(tripsRoutes).toMatch(/Điểm (đi|đón) (cụ thể|chính)|Địa điểm chính/)
    expect(tripsRoutes).toContain('Tỉnh/Thành đến')
    expect(tripsRoutes).toMatch(/Điểm (đến|trả) (cụ thể|chính)|Địa điểm chính/)
    expect(tripsRoutes).toContain('departureLocationId')
    expect(tripsRoutes).toContain('arrivalLocationId')
    expect(tripsRoutes).not.toContain('name="route"')
    expect(tripsRoutes).toContain('<th>Sơ đồ ghế</th>')
    expect(tripsRoutes).toContain('<th>Thao tác</th>')
  })

  test('Tuyến xe là tổng hợp read-only từ chuyến', () => {
    expect(routeApi).toContain("'/summary'")
    expect(adminService).toContain('getRouteSummary')
    expect(app).toContain('path="tuyen-xe"')
    expect(routeSummary).toContain('Các tuyến xe đang khai thác')
    expect(routeSummary).toContain('Dữ liệu được tổng hợp tự động từ danh sách chuyến xe')
    expect(routeSummary).not.toContain('+ Thêm tuyến đường')
  })
})
