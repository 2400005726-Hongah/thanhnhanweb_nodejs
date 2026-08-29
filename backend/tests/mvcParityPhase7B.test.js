import { readFile } from 'node:fs/promises'

const paths = {
  cancellation: new URL('../src/services/cancellation.service.js', import.meta.url),
  deletion: new URL('../src/services/bookingDeletion.service.js', import.meta.url),
  adminService: new URL('../src/services/admin.service.js', import.meta.url),
  adminRoutes: new URL('../src/routes/admin.routes.js', import.meta.url),
  adminValidator: new URL('../src/validators/admin.validator.js', import.meta.url),
  bookingExcel: new URL('../src/services/bookingExcel.service.js', import.meta.url),
  bookingsPage: new URL('../../frontend/src/pages/admin/AdminBookingsPage.jsx', import.meta.url),
  bookingDetail: new URL('../../frontend/src/pages/admin/AdminBookingDetailPage.jsx', import.meta.url),
}

const files = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([name, url]) => [name, await readFile(url, 'utf8')]),
  ),
)

describe('Giai đoạn 7B MVC parity - vòng đời vé', () => {
  test('hủy vé chỉ cho vé Đã đặt và được phép đến trước giờ khởi hành', () => {
    expect(files.cancellation).toContain("const CANCELLABLE_BOOKING_STATUSES = ['CONFIRMED']")
    expect(files.cancellation).toContain('const cancelDeadline = departureTime')
    expect(files.cancellation).not.toContain('bookingCancelBeforeMinutes')
    expect(files.cancellation).toContain('Chuyến đã xuất bến. Hãy dùng chức năng Khách không đi.')
  })

  test('hủy vé đã thanh toán hoàn tiền và giải phóng ghế', () => {
    expect(files.cancellation).toContain("data: { status: 'REFUNDED' }")
    expect(files.cancellation).toContain("status: 'AVAILABLE'")
    expect(files.cancellation).toContain("action: 'CANCEL_BOOKING'")
  })

  test('Không đi giữ thanh toán và không giải phóng ghế', () => {
    const noShowStart = files.adminService.indexOf('const markBookingNoShow')
    const noShowEnd = files.adminService.indexOf('/*\n * Tài khoản', noShowStart)
    const noShowSource = files.adminService.slice(noShowStart, noShowEnd)

    expect(noShowSource).toContain("status: 'NO_SHOW'")
    expect(noShowSource).toContain('Lý do khách không đi phải có từ 5 đến 500 ký tự')
    expect(noShowSource).not.toContain('paymentStatus:')
    expect(noShowSource).not.toContain('tripSeat.updateMany')
  })

  test('xóa mềm chỉ cho vé Đã đặt chưa thanh toán trước giờ khởi hành', () => {
    expect(files.deletion).toContain("const DELETABLE_BOOKING_STATUSES = [\n  'CONFIRMED',\n]")
    expect(files.deletion).toContain("booking.paymentStatus === 'SUCCESS'")
    expect(files.deletion).toContain("status: 'DELETED'")
    expect(files.deletion).toContain("status: 'AVAILABLE'")
  })

  test('sửa vé chỉ sửa họ tên, SĐT, ghi chú nhân viên và khóa sau giờ khởi hành', () => {
    const updateStart = files.adminService.indexOf('const updateBookingContact')
    const updateEnd = files.adminService.indexOf('/*\n * Khách không đi', updateStart)
    const updateSource = files.adminService.slice(updateStart, updateEnd)

    expect(updateSource).toContain('passengerFullName')
    expect(updateSource).toContain('passengerPhone')
    expect(updateSource).toContain('staffNote')
    expect(updateSource).not.toContain('passengerEmail:')
    expect(updateSource).not.toContain('pickupPoint:')
    expect(updateSource).not.toContain('dropoffPoint:')
    expect(updateSource).toContain('Chỉ vé Đã đặt và chuyến chưa khởi hành mới được sửa thông tin.')

    expect(files.bookingDetail).toContain('Ghi chú nhân viên')
    expect(files.bookingDetail).not.toContain('name="passengerEmail"')
    expect(files.bookingDetail).not.toContain('name="pickupPoint"')
    expect(files.bookingDetail).not.toContain('name="dropoffPoint"')
  })

  test('lọc vé theo ngày xuất bến và xuất Excel toàn bộ kết quả lọc', () => {
    expect(files.adminValidator).toContain("query('departureDate').optional().isISO8601()")
    expect(files.adminService).toContain('listManagedBookingsForExport')
    expect(files.adminService).toContain('query.departureDate')
    expect(files.adminRoutes).toContain("'/bookings/export.xlsx'")
    expect(files.bookingExcel).toContain("'Mã giao dịch'")
    expect(files.bookingExcel).toContain("'Giờ xuất bến'")
    expect(files.bookingsPage).toContain('Ngày xuất bến')
    expect(files.bookingsPage).toContain('Xuất Excel')
  })
})
