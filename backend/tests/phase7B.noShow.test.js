import { jest } from '@jest/globals'

const booking = {
  id: '11111111-1111-4111-8111-111111111111',
  bookingCode: 'TNABCDEF1234567890',
  status: 'CONFIRMED',
  paymentStatus: 'SUCCESS',
  totalAmount: 450000,
  passengerFullName: 'Nguyễn Văn A',
  passengerPhone: '0912345678',
  passengerEmail: 'a@example.com',
  pickupPoint: 'Ea Tân',
  dropoffPoint: 'Quận 12',
  source: 'ONLINE',
  createdAt: new Date('2099-07-20T08:00:00.000Z'),
  trip: {
    departureTime: new Date('2099-07-20T10:00:00.000Z'),
  },
  items: [{ seatCode: 'A01', price: 450000 }],
  payments: [{ status: 'SUCCESS', paymentMethod: 'BANK_TRANSFER', amount: 450000 }],
}

const transaction = {
  booking: {
    findUnique: jest.fn(async () => ({
      id: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      trip: { ...booking.trip },
    })),
    update: jest.fn(async ({ data }) => ({
      ...booking,
      ...data,
      trip: { ...booking.trip },
      items: booking.items.map((item) => ({ ...item })),
      payments: booking.payments.map((payment) => ({ ...payment })),
    })),
  },
  tripSeat: {
    updateMany: jest.fn(),
  },
}

const prisma = {
  $transaction: jest.fn(async (callback) => callback(transaction)),
}

const writeAuditLog = jest.fn(async () => undefined)

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))
jest.unstable_mockModule('../src/services/auditLog.service.js', () => ({ writeAuditLog }))

const { markBookingNoShow } = await import('../src/services/admin.service.js')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Giai đoạn 7B - Khách không đi', () => {
  test('chỉ cho đánh dấu sau giờ khởi hành và giữ nguyên thanh toán/ghế', async () => {
    const result = await markBookingNoShow(
      booking.bookingCode,
      'Khách không có mặt tại điểm đón',
      { id: '22222222-2222-4222-8222-222222222222', role: 'STAFF', fullName: 'Nhân viên A' },
      new Date('2099-07-20T10:05:00.000Z'),
    )

    expect(result.status).toBe('NO_SHOW')
    expect(result.paymentStatus).toBe('SUCCESS')
    expect(transaction.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NO_SHOW',
        }),
      }),
    )
    expect(transaction.tripSeat.updateMany).not.toHaveBeenCalled()
  })

  test('chặn trước giờ khởi hành', async () => {
    await expect(
      markBookingNoShow(
        booking.bookingCode,
        'Khách báo không đi chuyến này',
        { id: '22222222-2222-4222-8222-222222222222', role: 'STAFF' },
        new Date('2099-07-20T09:30:00.000Z'),
      ),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  test('lý do phải từ 5 đến 500 ký tự', async () => {
    await expect(
      markBookingNoShow(
        booking.bookingCode,
        'abc',
        { id: '22222222-2222-4222-8222-222222222222', role: 'STAFF' },
        new Date('2099-07-20T10:05:00.000Z'),
      ),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
