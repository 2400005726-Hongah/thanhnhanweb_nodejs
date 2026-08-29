import { readFile } from 'node:fs/promises'

const paths = {
  adminRoutes: new URL('../src/routes/admin.routes.js', import.meta.url),
  paymentCollection: new URL('../src/services/paymentCollection.service.js', import.meta.url),
  bookingDeletion: new URL('../src/services/bookingDeletion.service.js', import.meta.url),
  passengerPage: new URL('../../frontend/src/pages/admin/AdminTripPassengersPage.jsx', import.meta.url),
  bookingDetail: new URL('../../frontend/src/pages/admin/AdminBookingDetailPage.jsx', import.meta.url),
  bookingsPage: new URL('../../frontend/src/pages/admin/AdminBookingsPage.jsx', import.meta.url),
  adminFrontendService: new URL('../../frontend/src/services/admin.service.js', import.meta.url),
}

const entries = await Promise.all(
  Object.entries(paths).map(async ([key, url]) => [key, await readFile(url, 'utf8')]),
)
const files = Object.fromEntries(entries)

describe('Giai đoạn 7 MVC parity - quản lý vé và hành khách', () => {
  test('có API xác nhận đã thu tiền và hoàn tác thu tiền', () => {
    expect(files.adminRoutes).toContain("'/bookings/:bookingCode/collect-payment'")
    expect(files.adminRoutes).toContain("'/bookings/:bookingCode/undo-payment'")
    expect(files.adminFrontendService).toContain('collectBookingPayment')
    expect(files.adminFrontendService).toContain('undoBookingPayment')
  })

  test('xác nhận thu tiền chỉ dành cho PAY_AT_BUS và vé Đã đặt', () => {
    expect(files.paymentCollection).toContain("booking.status !== 'CONFIRMED'")
    expect(files.paymentCollection).toContain("payment.paymentMethod !== 'PAY_AT_BUS'")
    expect(files.paymentCollection).toContain("payment.status !== 'PENDING'")
    expect(files.paymentCollection).toContain("paymentStatus: 'SUCCESS'")
    expect(files.paymentCollection).toContain("action: 'PAYMENT_SUCCESS'")
  })

  test('hoàn tác thu tiền chỉ dành cho Chủ xe và có lý do', () => {
    expect(files.paymentCollection).toContain("actor?.role !== 'ADMIN'")
    expect(files.paymentCollection).toContain('Lý do hoàn tác phải có từ 5 đến 500 ký tự')
    expect(files.paymentCollection).toContain("paymentStatus: 'PENDING'")
    expect(files.paymentCollection).toContain("action: 'PAYMENT_PENDING'")
  })

  test('xóa vé giống MVC: chỉ vé Đã đặt, chưa thanh toán, trước giờ khởi hành', () => {
    expect(files.bookingDeletion).toContain("'CONFIRMED'")
    expect(files.bookingDeletion).not.toContain("'PENDING',\n  'CONFIRMED'")
    expect(files.bookingDeletion).toContain("booking.paymentStatus === 'SUCCESS'")
    expect(files.bookingDeletion).toContain('Vé đã thanh toán nên không thể xóa')
    expect(files.bookingDeletion).toContain('Không thể xóa vé sau giờ khởi hành')
  })

  test('danh sách hành khách có Khách không đi và Đã thu tiền', () => {
    expect(files.passengerPage).toContain('Khách không đi')
    expect(files.passengerPage).toContain('Đã thu tiền')
    expect(files.passengerPage).toContain('Hoàn tác thu tiền')
    expect(files.passengerPage).toContain("payment?.paymentMethod === 'PAY_AT_BUS'")
  })

  test('trang Vé xe và Chi tiết vé cũng có thao tác thu tiền', () => {
    expect(files.bookingsPage).toContain('Đã thu tiền')
    expect(files.bookingDetail).toContain('Đã thu tiền')
    expect(files.bookingDetail).toContain('Hoàn tác thu tiền')
  })
})
