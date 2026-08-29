import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const [
  schema,
  migration,
  routes,
  service,
  validator,
  catalog,
  tripsPage,
  bookingFields,
  bookingStep2,
] = await Promise.all([
  read('../prisma/schema.prisma'),
  read('../prisma/migrations/20260811000300_trip_service_point_dynamic/migration.sql'),
  read('../src/routes/trip.routes.js'),
  read('../src/services/tripServicePoint.service.js'),
  read('../src/validators/tripServicePoint.validator.js'),
  read('../src/config/servicePointCatalog.js'),
  read('../../frontend/src/pages/admin/AdminTripsRoutesPage.jsx'),
  read('../../frontend/src/components/booking/BookingServicePointFields.jsx'),
  read('../../frontend/src/pages/BookingServicePointPage.jsx'),
])

describe('Điểm đón/trả theo từng chuyến - mô hình 3 lựa chọn hiện hành', () => {
  test('TripServicePoint giữ địa điểm, hình thức, thứ tự, giờ dự kiến và trạng thái', () => {
    expect(schema).toContain('model TripServicePoint')
    expect(schema).toContain('serviceMode')
    expect(schema).toContain('estimatedTime')
    expect(schema).toContain('isDefault')
    expect(schema).toContain('sortOrder')
    expect(schema).toContain('@@unique([tripId, locationId, pointType, serviceMode]')
    expect(migration).toContain('trip_service_points_trip_location_type_mode_key')
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i)
  })

  test('Admin Thêm/Sửa chuyến cấu hình đủ 3 lựa chọn đón và 3 lựa chọn trả', () => {
    expect(tripsPage).toContain('1. Điểm đón chính')
    expect(tripsPage).toContain('2. Xe trung chuyển đón khách')
    expect(tripsPage).toContain('3. Đón khách tại điểm hẹn')
    expect(tripsPage).toContain('1. Điểm trả chính')
    expect(tripsPage).toContain('2. Xe trung chuyển trả tận nơi')
    expect(tripsPage).toContain('3. Trả khách tại điểm dừng')
    expect(tripsPage).toContain('primaryPickupMode')
    expect(tripsPage).toContain('primaryDropoffMode')
    expect(tripsPage).toContain('allowPickupTransfer')
    expect(tripsPage).toContain('allowPickupMeetingPoint')
    expect(tripsPage).toContain('allowDropoffTransfer')
    expect(tripsPage).toContain('allowDropoffStop')
    expect(tripsPage).toContain('configureTripServicePoints')
    expect(routes).toContain("'/:id/service-points'")
    expect(routes).toContain('updateTripServicePoints')
  })

  test('điểm chính được backend lưu là mặc định của chuyến', () => {
    expect(service).toContain('trip.departureLocationId')
    expect(service).toContain('trip.arrivalLocationId')
    expect(service).toContain('isDefault: true')
    expect(service).toContain("status: 'ACTIVE'")
    expect(service).toContain('primaryPickupMode')
    expect(service).toContain('primaryDropoffMode')
  })

  test('điểm phụ chỉ dùng Điểm hẹn cho đón và Điểm dừng cho trả', () => {
    expect(service).toContain('PICKUP_SERVICE_MODES.MEETING_POINT')
    expect(service).toContain('DROPOFF_SERVICE_MODES.STOP')
    expect(validator).toContain("value !== 'DonTaiDiemHen'")
    expect(validator).toContain("value !== 'TraTaiDiemDung'")
  })

  test('điểm đã có khách sử dụng không bị xóa vật lý', () => {
    expect(service).toContain('pickupBookings')
    expect(service).toContain('dropoffBookings')
    expect(service).toContain("data: { status: 'INACTIVE', isDefault: false }")
  })

  test('giờ điểm hẹn/điểm dừng do Admin nhập HH:mm và chỉ dùng hiển thị tham khảo', () => {
    expect(tripsPage).toContain('estimatedTime')
    expect(validator).toContain("body('servicePoints.*.estimatedTime')")
    expect(validator).toContain('Giờ dự kiến phải có định dạng HH:mm')
    expect(bookingFields).toContain('formatServiceTime')
    expect(bookingFields).toContain('point.estimatedTime')
    expect(bookingStep2).toContain('Thời gian tại từng điểm chỉ là thời gian dự kiến để tham khảo')
  })

  test('Bước 2 hiển thị đúng 3 phương án và chỉ chọn một radio ở mỗi bên', () => {
    expect(bookingFields).toContain('<strong>Điểm đón</strong>')
    expect(bookingFields).toContain('<strong>Điểm trả</strong>')
    expect(bookingFields).toContain('type="radio"')
    expect(bookingFields).toContain('Tập trung tại văn phòng nhà xe')
    expect(bookingFields).toContain('Đón trực tiếp tại bến xe trung tâm thành phố')
    expect(bookingFields).toContain('Xe trung chuyển đón khách')
    expect(bookingFields).toContain('Đón khách tại điểm hẹn')
    expect(bookingFields).toContain('Xe trung chuyển trả tận nơi khu vực nội thành')
    expect(bookingFields).toContain('Trả khách tại điểm dừng')
    expect(bookingFields).toContain('pickupServicePointId')
    expect(bookingFields).toContain('dropoffServicePointId')
  })

  test('catalog giữ đủ mã nội bộ và helper kiểm tra hình thức', () => {
    for (const value of [
      'DiemChinh',
      'DiemHen',
      'DiemDung',
      'TrungChuyen',
      'TaiVanPhong',
      'DonTaiBenXe',
      'DonTaiDiemHen',
      'TrungChuyenDonKhach',
      'TraTaiBenXe',
      'TraTaiVanPhong',
      'TraTaiDiemDung',
      'TrungChuyenTraKhach',
    ]) {
      expect(catalog).toContain(value)
    }
    expect(catalog).toContain('isPickupServiceMode')
    expect(catalog).toContain('isDropoffServiceMode')
  })
})
