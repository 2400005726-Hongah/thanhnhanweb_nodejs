import { readFile } from 'node:fs/promises'

const appPath = new URL('../../frontend/src/App.jsx', import.meta.url)
const layoutPath = new URL(
  '../../frontend/src/layouts/AdminLayout.jsx',
  import.meta.url,
)
const tripsRoutesPath = new URL(
  '../../frontend/src/pages/admin/AdminTripsRoutesPage.jsx',
  import.meta.url,
)

const [app, layout, tripsRoutes] = await Promise.all([
  readFile(appPath, 'utf8'),
  readFile(layoutPath, 'utf8'),
  readFile(tripsRoutesPath, 'utf8'),
])

describe('ADMIN/STAFF frontend permission structure', () => {
  test('protects the admin area for ADMIN and STAFF', () => {
    expect(app).toContain(
      "<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} />",
    )
    expect(app).toContain('path="chuyen-xe-tuyen-duong"')
  })

  test('renders trips and routes on the same management page', () => {
    expect(tripsRoutes).toContain('Danh sách chuyến xe')
    expect(tripsRoutes).toContain('Danh sách tuyến đường')
  })

  test('uses permissions to show create/delete controls', () => {
    expect(tripsRoutes).toContain('PERMISSIONS.CREATE_TRIPS')
    expect(tripsRoutes).toContain('PERMISSIONS.DELETE_TRIPS')
    expect(tripsRoutes).toContain('PERMISSIONS.CREATE_ROUTES')
    expect(tripsRoutes).toContain('PERMISSIONS.DELETE_ROUTES')
    expect(tripsRoutes).toContain('{canCreateTrips &&')
    expect(tripsRoutes).toContain('{canDeleteTrips &&')
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
