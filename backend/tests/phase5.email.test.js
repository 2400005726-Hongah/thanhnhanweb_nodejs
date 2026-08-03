import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const writeAuditLog = jest.fn(async () => ({}))
const sendEmail = jest.fn()

jest.unstable_mockModule('../src/config/prisma.js', () => ({
  default: {},
}))
jest.unstable_mockModule('../src/services/auditLog.service.js', () => ({
  writeAuditLog,
}))
jest.unstable_mockModule('../src/services/emailTransport.service.js', () => ({
  sendEmail,
}))

const { buildBookingEmail } = await import(
  '../src/templates/bookingEmail.template.js'
)
const { attachEmailDelivery, sendBookingEmailAfterCommit } = await import(
  '../src/services/bookingEmail.service.js'
)

const makeBooking = (overrides = {}) => ({
  id: 'booking-id',
  bookingCode: 'TNABCDEF1234567890',
  source: 'ONLINE',
  status: 'CONFIRMED',
  paymentStatus: 'SUCCESS',
  totalAmount: 620000,
  customerNote: '<img src=x onerror=alert(1)>',
  passenger: {
    fullName: 'Nguyễn <script>alert(1)</script>',
    phone: '0987654321',
    email: 'passenger@example.com',
  },
  trip: {
    departureTime: new Date('2026-08-10T01:00:00.000Z'),
    route: { routeName: 'Buôn Hồ - TP. Hồ Chí Minh' },
    bus: {
      busName: 'Limousine 22 phòng',
      licensePlate: '47B-123.45',
    },
  },
  seats: [
    { seatCode: 'P01', price: 620000 },
  ],
  payment: {
    paymentMethod: 'BANK_TRANSFER',
    status: 'SUCCESS',
  },
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Phase 5 booking Email', () => {
  test('builds escaped HTML, text fallback and Vietnamese booking details', () => {
    const message = buildBookingEmail(makeBooking())

    expect(message.subject).toContain('TNABCDEF1234567890')
    expect(message.text).toContain('NHÀ XE THÀNH NHÂN - VÉ ĐIỆN TỬ')
    expect(message.text).toContain('Thanh toán đã được ghi nhận.')
    expect(message.html).toContain('Nguyễn &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(message.html).not.toContain('<script>alert(1)</script>')
    expect(message.html).not.toContain('onerror=alert(1)')
    expect(message.text).not.toContain('onerror=alert(1)')
  })

  test('PAY_AT_BUS Email clearly asks the passenger to pay on the bus', () => {
    const message = buildBookingEmail(
      makeBooking({
        paymentStatus: 'PENDING',
        payment: { paymentMethod: 'PAY_AT_BUS', status: 'PENDING' },
      }),
    )

    expect(message.text).toContain(
      'Vé đã được giữ chỗ. Quý khách thanh toán khi lên xe.',
    )
    expect(message.text).toContain('Trạng thái thanh toán: Chưa thanh toán')
    expect(message.text).not.toContain('Thanh toán đã được ghi nhận.')
  })

  test('records EMAIL_SENT after the committed booking is handed to Email', async () => {
    sendEmail.mockResolvedValueOnce({ sent: true, messageId: 'message-id' })
    const booking = makeBooking()

    const delivery = await sendBookingEmailAfterCommit(booking, {
      id: 'actor-id',
      role: 'STAFF',
      fullName: 'Nhân viên',
    })

    expect(delivery).toEqual({
      emailSent: true,
      emailStatus: 'SENT',
      emailWarning: null,
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'passenger@example.com',
        text: expect.stringContaining(booking.bookingCode),
        html: expect.stringContaining(booking.bookingCode),
      }),
      undefined,
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMAIL_SENT',
        entityId: booking.id,
      }),
      {},
    )
  })

  test('Email failure returns a warning without changing booking, Payment or seats', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    sendEmail.mockRejectedValueOnce(
      Object.assign(new Error('SMTP password=must-not-leak'), {
        code: 'ECONNECTION',
      }),
    )
    const booking = makeBooking({
      seats: [{ seatCode: 'P01', price: 620000, status: 'BOOKED' }],
    })
    const snapshot = structuredClone(booking)

    const result = await attachEmailDelivery({ booking }, null)

    expect(result).toMatchObject({
      emailSent: false,
      emailStatus: 'FAILED',
      emailWarning: 'Đặt vé thành công nhưng Email vé chưa được gửi.',
      booking: {
        id: booking.id,
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        payment: { status: 'SUCCESS' },
        seats: [{ status: 'BOOKED' }],
      },
    })
    expect(booking).toEqual(snapshot)
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMAIL_FAILED' }),
      {},
    )
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'must-not-leak',
    )
    consoleError.mockRestore()
  })

  test.each(['HOTLINE', 'COUNTER'])(
    '%s booking without Email is kept and Email is skipped',
    async (source) => {
      const booking = makeBooking({
        source,
        passenger: {
          fullName: 'Khách không Email',
          phone: '0987654321',
          email: null,
        },
      })

      await expect(sendBookingEmailAfterCommit(booking)).resolves.toEqual({
        emailSent: false,
        emailStatus: 'SKIPPED',
        emailWarning: null,
      })
      expect(sendEmail).not.toHaveBeenCalled()
      expect(writeAuditLog).not.toHaveBeenCalled()
    },
  )
})
