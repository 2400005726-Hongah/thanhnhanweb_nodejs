import { readFile } from 'node:fs/promises'

const files = Object.fromEntries(
  await Promise.all(
    Object.entries({
      bookingService: new URL('../src/services/booking.service.js', import.meta.url),
      bookingPointService: new URL('../src/services/bookingServicePoint.service.js', import.meta.url),
      servicePointCatalog: new URL('../src/config/servicePointCatalog.js', import.meta.url),
      bookingValidator: new URL('../src/validators/booking.validator.js', import.meta.url),
      bookingController: new URL('../src/controllers/booking.controller.js', import.meta.url),
      publicRoutes: new URL('../src/routes/public.routes.js', import.meta.url),
      publicTripService: new URL('../src/services/publicTrip.service.js', import.meta.url),
      step1: new URL('../../frontend/src/pages/TripDetailPage.jsx', import.meta.url),
      step2: new URL('../../frontend/src/pages/BookingServicePointPage.jsx', import.meta.url),
      step3: new URL('../../frontend/src/pages/BookingPage.jsx', import.meta.url),
      step4: new URL('../../frontend/src/pages/BookingPaymentPage.jsx', import.meta.url),
      flowSteps: new URL('../../frontend/src/components/booking/BookingFlowSteps.jsx', import.meta.url),
      managedBooking: new URL('../../frontend/src/pages/admin/AdminBookingCreatePage.jsx', import.meta.url),
      bookingPointFields: new URL('../../frontend/src/components/booking/BookingServicePointFields.jsx', import.meta.url),
      bookingApi: new URL('../../frontend/src/services/booking.service.js', import.meta.url),
    }).map(async ([name, path]) => [name, await readFile(path, 'utf8')]),
  ),
)

describe('Giai đoạn 6 - Đặt vé và điểm đón/trả', () => {
  test('public API công khai cấu hình điểm đón/trả của từng chuyến', () => {
    expect(files.publicRoutes).toContain("'/trips/:tripId/service-points'")
    expect(files.publicTripService).toContain('getPublicTripServicePoints')
  })

  test('backend tự resolve và snapshot điểm đón/trả, không tin ID location từ client', () => {
    expect(files.bookingService).toContain('resolveBookingServiceSelection')
    expect(files.bookingService).toContain('pickupLocationId: serviceSelection.pickup.locationId')
    expect(files.bookingService).toContain('dropoffLocationId: serviceSelection.dropoff.locationId')
    expect(files.bookingValidator).toContain("'pickupLocationId'")
    expect(files.bookingValidator).toContain("'dropoffLocationId'")
    expect(files.bookingApi).not.toContain('pickupLocationId')
    expect(files.bookingApi).not.toContain('dropoffLocationId')
  })

  test('giữ đủ 3 lựa chọn đón và 3 lựa chọn trả theo mô hình hiện hành', () => {
    for (const value of ['DiemChinh', 'DiemHen', 'TrungChuyen']) {
      expect(files.servicePointCatalog).toContain(value)
    }
    for (const value of ['DiemChinh', 'DiemDung', 'TrungChuyen']) {
      expect(files.servicePointCatalog).toContain(value)
    }
    expect(files.bookingPointService).toContain('PICKUP_KINDS.PRIMARY')
    expect(files.bookingPointService).toContain('PICKUP_KINDS.TRANSFER')
    expect(files.bookingPointService).toContain('PICKUP_KINDS.MEETING_POINT')
    expect(files.bookingPointService).toContain('DROPOFF_KINDS.PRIMARY')
    expect(files.bookingPointService).toContain('DROPOFF_KINDS.TRANSFER')
    expect(files.bookingPointService).toContain('DROPOFF_KINDS.STOP')
  })

  test('Bước 2 hiển thị lựa chọn điểm chính, trung chuyển, điểm hẹn và điểm dừng', () => {
    expect(files.bookingPointFields).toContain('<strong>Điểm đón</strong>')
    expect(files.bookingPointFields).toContain('<strong>Điểm trả</strong>')
    expect(files.bookingPointFields).toContain('type="radio"')
    expect(files.bookingPointFields).toContain('Xe trung chuyển đón khách')
    expect(files.bookingPointFields).toContain('Đón khách tại điểm hẹn')
    expect(files.bookingPointFields).toContain('Xe trung chuyển trả tận nơi khu vực nội thành')
    expect(files.bookingPointFields).toContain('Trả khách tại điểm dừng')
    expect(files.bookingPointFields).toContain('Địa chỉ cần đón')
    expect(files.bookingPointFields).toContain('Địa chỉ cần trả')
    expect(files.bookingPointFields).toContain('pickupServicePointId')
    expect(files.bookingPointFields).toContain('dropoffServicePointId')
  })

  test('trung chuyển bắt buộc địa chỉ cụ thể ở frontend và backend', () => {
    expect(files.bookingPointFields).toContain('Vui lòng nhập địa chỉ đón cụ thể cho xe trung chuyển.')
    expect(files.bookingPointFields).toContain('Vui lòng nhập địa chỉ trả cụ thể cho xe trung chuyển.')
    expect(files.bookingPointService).toContain('normalizeRequestedAddress')
    expect(files.bookingPointService).toContain('Vui lòng nhập địa chỉ ${label} cụ thể cho xe trung chuyển')
  })

  test('luồng Online có đúng 4 bước và chỉ Bước 4 mới giữ ghế', () => {
    expect(files.flowSteps).toContain("{ number: 1, label: 'Chọn chỗ' }")
    expect(files.flowSteps).toContain("{ number: 2, label: 'Chọn điểm đón, trả' }")
    expect(files.flowSteps).toContain("{ number: 3, label: 'Nhập thông tin' }")
    expect(files.flowSteps).toContain("{ number: 4, label: 'Thanh toán' }")
    expect(files.step1).not.toContain('holdSeats(')
    expect(files.step2).not.toContain('holdSeats(')
    expect(files.step3).not.toContain('holdSeats(')
    expect(files.step4).toContain('holdSeats(')
    expect(files.step4).toContain('saveSeatHold')
    expect(files.step4).toContain('holdToken: hold.holdToken')
  })

  test('Bước 4 gửi đúng lựa chọn đón/trả và phương thức thanh toán', () => {
    expect(files.step4).toContain('pickupKind: serviceSelection.pickupKind')
    expect(files.step4).toContain('dropoffKind: serviceSelection.dropoffKind')
    expect(files.step4).toContain('pickupServicePointId: serviceSelection.pickupServicePointId')
    expect(files.step4).toContain('dropoffServicePointId: serviceSelection.dropoffServicePointId')
    expect(files.step4).toContain('paymentMethod,')
  })

  test('Hotline và Tại quầy dùng cùng quy tắc điểm đón/trả', () => {
    expect(files.managedBooking).toContain('BookingServicePointFields')
    expect(files.managedBooking).toContain('pickupKind: serviceSelection.pickupKind')
    expect(files.managedBooking).toContain('dropoffKind: serviceSelection.dropoffKind')
    expect(files.managedBooking).toContain('paymentMethod,')
  })

  test('email Online vẫn gửi sau commit và Hotline giữ SMS mô phỏng', () => {
    expect(files.bookingController).toContain('attachEmailDelivery(bookingResult')
    expect(files.bookingController).toContain('gửi SMS mô phỏng')
  })
})
