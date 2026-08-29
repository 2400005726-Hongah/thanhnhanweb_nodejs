import { readFile } from 'node:fs/promises'

const paths = {
  paymentLabels: new URL(
    '../../frontend/src/utils/paymentLabels.js',
    import.meta.url,
  ),
  onlineBooking: new URL(
    '../../frontend/src/pages/BookingPaymentPage.jsx',
    import.meta.url,
  ),
  managedBooking: new URL(
    '../../frontend/src/pages/admin/AdminBookingCreatePage.jsx',
    import.meta.url,
  ),
  bookingSuccess: new URL(
    '../../frontend/src/pages/BookingSuccessPage.jsx',
    import.meta.url,
  ),
  ticketLookup: new URL(
    '../../frontend/src/pages/TicketLookupPage.jsx',
    import.meta.url,
  ),
  adminBookings: new URL(
    '../../frontend/src/pages/admin/AdminBookingsPage.jsx',
    import.meta.url,
  ),
  publicRoutes: new URL('../src/routes/public.routes.js', import.meta.url),
  adminRoutes: new URL('../src/routes/admin.routes.js', import.meta.url),
}

const entries = await Promise.all(
  Object.entries(paths).map(async ([name, path]) => [name, await readFile(path, 'utf8')]),
)
const files = Object.fromEntries(entries)

describe('Phase 5 payment frontend and route boundaries', () => {
  test('defines the exact method labels and source-specific choices', () => {
    for (const [method, label] of [
      ['BANK_TRANSFER', 'Chuyển khoản ngân hàng'],
      ['BANK_QR', 'QR ngân hàng'],
      ['MOMO', 'Ví MoMo'],
      ['ZALOPAY', 'ZaloPay'],
      ['VNPAY', 'VNPay'],
      ['CARD_POS', 'Thẻ/POS'],
      ['CASH_COUNTER', 'Tiền mặt tại quầy'],
      ['PAY_AT_BUS', 'Thanh toán tại nhà xe'],
      ['SIMULATED', 'Thanh toán mô phỏng'],
    ]) {
      expect(files.paymentLabels).toContain(`${method}: '${label}'`)
    }

    expect(files.paymentLabels).toMatch(
      /ONLINE:[\s\S]*'PAY_AT_BUS',[\s\S]*'SIMULATED'/,
    )
    expect(files.paymentLabels).toMatch(
      /COUNTER:[\s\S]*'CASH_COUNTER',[\s\S]*'CARD_POS',[\s\S]*'PAY_AT_BUS'/,
    )
  })

  test('booking forms send only the chosen method, never a client payment status or amount', () => {
    expect(files.onlineBooking).toContain('paymentMethod,')
    expect(files.managedBooking).toContain('paymentMethod,')
    expect(files.onlineBooking).not.toContain('paymentStatus:')
    expect(files.managedBooking).not.toContain('paymentStatus:')
    expect(files.managedBooking).not.toContain('totalAmount:')
    expect(files.onlineBooking).toContain('submitting')
    expect(files.managedBooking).toContain('submitting')
  })

  test('PAY_AT_BUS is shown as unpaid and never as payment success', () => {
    expect(files.bookingSuccess).toContain(
      "const isPayAtBus = payment?.paymentMethod === 'PAY_AT_BUS'",
    )
    expect(files.bookingSuccess).toContain('Thanh toán: Chưa thanh toán')
    expect(files.bookingSuccess).toContain(
      'Quý khách vui lòng thanh toán khi lên xe.',
    )
    expect(files.ticketLookup).toContain('getPaymentMethodLabel')
    expect(files.ticketLookup).toContain('getPaymentStatusLabel')
    expect(files.adminBookings).toContain('getPaymentMethodLabel')
    expect(files.adminBookings).toContain('getPaymentStatusLabel')
  })

  test('supports PAY_AT_BUS collection through authenticated admin management', () => {
    const routeText = `${files.publicRoutes}\n${files.adminRoutes}`
    const frontendText = `${files.bookingSuccess}\n${files.adminBookings}`

    expect(routeText).toMatch(/collect-payment/i)
    expect(frontendText).toMatch(/Đã thu tiền|collect-payment/i)
  })
})
