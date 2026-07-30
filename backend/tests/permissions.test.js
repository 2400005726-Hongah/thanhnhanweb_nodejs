import {
  getPermissionsForRole,
  hasPermission,
  PERMISSIONS,
  ROLE_LABELS,
} from '../src/config/permissions.js'

describe('centralized ADMIN and STAFF permissions', () => {
  test('uses distinct Vietnamese labels without changing enum names', () => {
    expect(ROLE_LABELS.ADMIN).toBe('Chủ xe')
    expect(ROLE_LABELS.STAFF).toBe('Nhân viên quản trị')
  })

  test('ADMIN has every permission', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission('ADMIN', permission)).toBe(true)
    }
  })

  test('STAFF has operation permissions but no sensitive permissions', () => {
    expect(hasPermission('STAFF', PERMISSIONS.EDIT_TRIPS)).toBe(true)
    expect(hasPermission('STAFF', PERMISSIONS.EDIT_ROUTES)).toBe(true)
    expect(hasPermission('STAFF', PERMISSIONS.MANAGE_NEWS)).toBe(true)
    expect(hasPermission('STAFF', PERMISSIONS.VIEW_REVENUE)).toBe(false)
    expect(hasPermission('STAFF', PERMISSIONS.MANAGE_USERS)).toBe(false)
    expect(hasPermission('STAFF', PERMISSIONS.VIEW_SYSTEM_LOGS)).toBe(false)
    expect(hasPermission('STAFF', PERMISSIONS.CREATE_TRIPS)).toBe(false)
    expect(hasPermission('STAFF', PERMISSIONS.DELETE_ROUTES)).toBe(false)
    expect(hasPermission('STAFF', PERMISSIONS.MANAGE_BUSES)).toBe(false)
  })

  test('permissions returned to frontend are copied, not mutable source state', () => {
    const permissions = getPermissionsForRole('STAFF')
    permissions.push(PERMISSIONS.MANAGE_USERS)
    expect(hasPermission('STAFF', PERMISSIONS.MANAGE_USERS)).toBe(false)
  })
})
