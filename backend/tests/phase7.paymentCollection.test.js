import { jest } from '@jest/globals'

const auditLog = jest.fn(async () => undefined)

const makeTransaction = ({
  bookingStatus = 'CONFIRMED',
  bookingPaymentStatus = 'PENDING',
  paymentMethod = 'PAY_AT_BUS',
  paymentStatus = 'PENDING',
} = {}) => {
  const booking = {
    id: '11111111-1111-4111-8111-111111111111',
    bookingCode: 'TN000001',
    status: bookingStatus,
    paymentStatus: bookingPaymentStatus,
    totalAmount: 350000,
  }

  const payment = {
    id: '22222222-2222-4222-8222-222222222222',
    paymentMethod,
    status: paymentStatus,
    amount: 350000,
    transactionCode: null,
    paidAt: paymentStatus === 'SUCCESS' ? new Date('2026-08-10T10:00:00Z') : null,
    createdAt: new Date('2026-08-10T09:00:00Z'),
  }

  return {
    $queryRaw: jest.fn(async () => [{ id: booking.id }]),
    booking: {
      findUnique: jest.fn(async () => booking),
      update: jest.fn(async ({ data }) => Object.assign(booking, data)),
    },
    payment: {
      findFirst: jest.fn(async () => payment),
      updateMany: jest.fn(async ({ where, data }) => {
        if (where.status !== payment.status) return { count: 0 }
        Object.assign(payment, data)
        return { count: 1 }
      }),
    },
    __booking: booking,
    __payment: payment,
  }
}

let transaction = makeTransaction()
const prisma = {
  $transaction: jest.fn(async (callback) => callback(transaction)),
}

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))
jest.unstable_mockModule('../src/services/auditLog.service.js', () => ({
  writeAuditLog: auditLog,
}))

const {
  confirmCollectedPayment,
  undoCollectedPayment,
} = await import('../src/services/paymentCollection.service.js')

const actor = {
  id: '33333333-3333-4333-8333-333333333333',
  role: 'STAFF',
  fullName: 'Nhân viên A',
}

describe('Giai đoạn 7 - xác nhận thu tiền vé', () => {
  beforeEach(() => {
    transaction = makeTransaction()
    auditLog.mockClear()
    prisma.$transaction.mockClear()
  })

  test('nhân viên xác nhận thu tiền PAY_AT_BUS đang chờ', async () => {
    const result = await confirmCollectedPayment({
      bookingCode: 'TN000001',
      actor,
      confirmed: true,
      now: new Date('2026-08-11T00:00:00Z'),
    })

    expect(result.paymentStatus).toBe('SUCCESS')
    expect(transaction.__booking.paymentStatus).toBe('SUCCESS')
    expect(transaction.__payment.status).toBe('SUCCESS')
    expect(transaction.__payment.paidAt).toEqual(new Date('2026-08-11T00:00:00Z'))
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_SUCCESS' }),
      transaction,
    )
  })

  test('bắt buộc xác nhận đã nhận đủ tiền', async () => {
    await expect(
      confirmCollectedPayment({
        bookingCode: 'TN000001',
        actor,
        confirmed: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('chỉ áp dụng cho Thanh toán khi lên xe', async () => {
    transaction = makeTransaction({ paymentMethod: 'BANK_TRANSFER' })

    await expect(
      confirmCollectedPayment({
        bookingCode: 'TN000001',
        actor,
        confirmed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  test('không xác nhận trùng vé đã thanh toán', async () => {
    transaction = makeTransaction({
      bookingPaymentStatus: 'SUCCESS',
      paymentStatus: 'SUCCESS',
    })

    await expect(
      confirmCollectedPayment({
        bookingCode: 'TN000001',
        actor,
        confirmed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  test('chỉ Chủ xe được hoàn tác xác nhận thu tiền', async () => {
    transaction = makeTransaction({
      bookingPaymentStatus: 'SUCCESS',
      paymentStatus: 'SUCCESS',
    })

    await expect(
      undoCollectedPayment({
        bookingCode: 'TN000001',
        actor,
        reason: 'Nhân viên xác nhận nhầm',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  test('Chủ xe hoàn tác đưa thanh toán về Chưa thanh toán', async () => {
    transaction = makeTransaction({
      bookingPaymentStatus: 'SUCCESS',
      paymentStatus: 'SUCCESS',
    })

    const result = await undoCollectedPayment({
      bookingCode: 'TN000001',
      actor: { ...actor, role: 'ADMIN' },
      reason: 'Xác nhận thu tiền nhầm vé',
      now: new Date('2026-08-11T01:00:00Z'),
    })

    expect(result.paymentStatus).toBe('PENDING')
    expect(transaction.__booking.paymentStatus).toBe('PENDING')
    expect(transaction.__payment.status).toBe('PENDING')
    expect(transaction.__payment.paidAt).toBeNull()
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_PENDING',
        reason: 'Xác nhận thu tiền nhầm vé',
      }),
      transaction,
    )
  })
})
