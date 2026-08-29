import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DROPOFF_KINDS,
  DROPOFF_SERVICE_MODES,
  LOCATION_TYPES,
  PICKUP_KINDS,
  PICKUP_SERVICE_MODES,
  SERVICE_POINT_TYPES,
  normalizePrimaryDropoffMode,
  normalizePrimaryPickupMode,
  normalizeServiceMode,
} from '../src/config/servicePointCatalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const schema = fs.readFileSync(path.join(backendDir, 'prisma', 'schema.prisma'), 'utf8')
const migration = fs.readFileSync(
  path.join(
    backendDir,
    'prisma',
    'migrations',
    '20260810000100_mvc_parity_foundation',
    'migration.sql',
  ),
  'utf8',
)

describe('nền tảng tương thích ThanhNhanWeb MVC', () => {
  test('bổ sung đủ các bảng địa điểm và điểm phục vụ còn thiếu từ MVC', () => {
    for (const model of [
      'Province',
      'PickupDropoffArea',
      'LocationAreaFilter',
      'RouteStop',
      'TripServicePoint',
    ]) {
      expect(schema).toContain(`model ${model} {`)
    }
  })

  test('giữ nguyên các model Node lõi thay vì thay schema phá dữ liệu', () => {
    for (const model of [
      'User',
      'Customer',
      'Location',
      'Route',
      'Bus',
      'Seat',
      'Trip',
      'TripSeat',
      'Booking',
      'BookingItem',
      'Payment',
      'News',
      'AuditLog',
    ]) {
      expect(schema).toContain(`model ${model} {`)
    }
  })

  test('Trip có trạng thái bán, vận hành và thời điểm hoàn thành riêng', () => {
    expect(schema).toContain('salesStatus')
    expect(schema).toContain('operationStatus')
    expect(schema).toContain('completedAt')
    expect(schema).toContain('primaryPickupMode')
    expect(schema).toContain('primaryDropoffMode')
  })

  test('Booking lưu snapshot và khóa ngoại điểm đón trả giống MVC', () => {
    for (const field of [
      'pickupLocationId',
      'dropoffLocationId',
      'pickupServicePointId',
      'dropoffServicePointId',
      'pickupServiceMode',
      'dropoffServiceMode',
      'pickupKind',
      'dropoffKind',
      'pickupRequestedAddress',
      'dropoffRequestedAddress',
      'smsSent',
      'smsSentAt',
    ]) {
      expect(schema).toContain(field)
    }
  })

  test('migration là bổ sung không phá dữ liệu và có backfill', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS')
    expect(migration).toContain('INSERT INTO public.provinces')
    expect(migration).toContain('UPDATE public.locations AS l')
    expect(migration).toContain('UPDATE public.trips AS t')
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN/i)
  })

  test('danh mục hình thức đón giữ đúng mã của dự án MVC', () => {
    expect(Object.values(PICKUP_SERVICE_MODES)).toEqual(
      expect.arrayContaining([
        'TaiVanPhong',
        'DonTaiBenXe',
        'DonTaiDiemHen',
        'TrungChuyenDonKhach',
      ]),
    )
    expect(PICKUP_KINDS).toEqual(
      expect.objectContaining({
        PRIMARY: 'DiemChinh',
        TRANSFER: 'TrungChuyen',
        MEETING_POINT: 'DiemHen',
      }),
    )
  })

  test('danh mục hình thức trả giữ đúng mã của dự án MVC', () => {
    expect(Object.values(DROPOFF_SERVICE_MODES)).toEqual(
      expect.arrayContaining([
        'TraTaiBenXe',
        'TraTaiVanPhong',
        'TraTaiDiemDung',
        'TrungChuyenTraKhach',
      ]),
    )
    expect(DROPOFF_KINDS).toEqual(
      expect.objectContaining({
        PRIMARY: 'DiemChinh',
        TRANSFER: 'TrungChuyen',
        STOP: 'DiemDung',
      }),
    )
  })

  test('chuẩn hóa hình thức phục vụ có fallback giống MVC', () => {
    expect(LOCATION_TYPES.BOTH).toBe('BOTH')
    expect(SERVICE_POINT_TYPES.PICKUP).toBe('PICKUP')
    expect(SERVICE_POINT_TYPES.DROPOFF).toBe('DROPOFF')
    expect(normalizePrimaryPickupMode('sai')).toBe('DonTaiBenXe')
    expect(normalizePrimaryDropoffMode('sai')).toBe('TraTaiBenXe')
    expect(normalizeServiceMode('PICKUP', 'sai')).toBe('DonTaiDiemHen')
    expect(normalizeServiceMode('DROPOFF', 'sai')).toBe('TraTaiDiemDung')
  })
  test('mở API danh mục địa điểm nhiều tầng tương đương DiaDiemController MVC', () => {
    const routes = fs.readFileSync(
      path.join(backendDir, 'src', 'routes', 'location.routes.js'),
      'utf8',
    )
    expect(routes).toContain("'/catalog'")
    expect(routes).toContain("'/provinces'")
    expect(routes).toContain("'/areas'")
    expect(routes).toContain("'/specific'")
    expect(routes).toContain('PERMISSIONS.EDIT_ROUTES')
  })

  test('giữ điểm đi/đến trực tiếp và cho phép cấu hình riêng 3 phương án đón/trả của chuyến', () => {
    const routes = fs.readFileSync(
      path.join(backendDir, 'src', 'routes', 'trip.routes.js'),
      'utf8',
    )
    const service = fs.readFileSync(
      path.join(backendDir, 'src', 'services', 'trip.service.js'),
      'utf8',
    )
    expect(routes).toContain("'/:id/service-points'")
    expect(routes).toContain('updateTripServicePoints')
    expect(routes).toContain('configureTripServicePointsValidator')
    expect(routes).not.toContain('Cấu hình điểm phục vụ chuyến kiểu cũ đã ngừng sử dụng')
    expect(service).toContain('salesStatus')
    expect(service).toContain('operationStatus')
    expect(service).toContain('completedAt')
  })

})
