import { readFile } from 'node:fs/promises'

const appPath = new URL('../../frontend/src/App.jsx', import.meta.url)
const layoutPath = new URL(
  '../../frontend/src/layouts/AdminLayout.jsx',
  import.meta.url,
)
const tripsPath = new URL(
  '../../frontend/src/pages/admin/AdminTripsRoutesPage.jsx',
  import.meta.url,
)
const routeSummaryPath = new URL(
  '../../frontend/src/pages/admin/AdminRoutesSummaryPage.jsx',
  import.meta.url,
)

const [app, layout, trips, routeSummary] = await Promise.all([
  readFile(appPath, 'utf8'),
  readFile(layoutPath, 'utf8'),
  readFile(tripsPath, 'utf8'),
  readFile(routeSummaryPath, 'utf8'),
])

describe('ADMIN/STAFF frontend permission structure', () => {
  test('protects the admin area for ADMIN and STAFF', () => {
    expect(app).toContain(
      "<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />",
    )
    expect(app).toContain('path="chuyen-xe"')
    expect(app).toContain('path="tuyen-xe"')
  })

  test('gộp quản lý chuyến với phần tổng hợp tuyến read-only', () => {
    expect(trips).toContain('Danh sách chuyến xe')
    expect(trips).toContain('AdminRoutesSummaryPage')
    expect(routeSummary).toContain('Các tuyến xe đang khai thác')
    expect(routeSummary).toContain('Dữ liệu được tổng hợp tự động từ danh sách chuyến xe')
  })

  test('uses permissions only for trip write controls; route section is read-only', () => {
    expect(trips).toContain('PERMISSIONS.CREATE_TRIPS')
    expect(trips).toContain('PERMISSIONS.DELETE_TRIPS')
    expect(trips).not.toContain('PERMISSIONS.CREATE_ROUTES')
    expect(trips).not.toContain('PERMISSIONS.DELETE_ROUTES')
    expect(trips).toContain('canCreateTrips')
    expect(trips).toContain('{canDeleteTrips &&')
    expect(routeSummary).not.toContain('+ Thêm tuyến')
  })

  test('hides revenue, users, and logs from STAFF menu by permission', () => {
    expect(layout).toContain('PERMISSIONS.VIEW_REVENUE')
    expect(layout).toContain('PERMISSIONS.MANAGE_USERS')
    expect(layout).toContain('PERMISSIONS.VIEW_SYSTEM_LOGS')
    expect(layout).toContain(
      '.filter((item) => hasPermission(user, item.permission))',
    )
  })
})
