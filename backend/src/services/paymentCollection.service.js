import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  normalizeBookingCode,
  normalizeMultilineText,
} from '../utils/normalize.js'
import { writeAuditLog } from './auditLog.service.js'

const TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 15000,
}

const getLatestPayment = async (database, bookingId) =>
  database.payment.findFirst({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      paymentMethod: true,
      status: true,
      amount: true,
      transactionCode: true,
      paidAt: true,
      createdAt: true,
    },
  })

const lockBooking = (database, bookingCode) =>
  database.$queryRaw`
    SELECT id
    FROM bookings
    WHERE booking_code = ${bookingCode}
    FOR UPDATE
  `

const requirePayAtBusBooking = (booking, payment) => {
  if (!booking) {
    throw new HttpError('Không tìm thấy vé', 404)
  }

  if (booking.status !== 'CONFIRMED') {
    throw new HttpError(
      'Chỉ vé đang ở trạng thái Đã đặt mới được xử lý thu tiền',
      409,
    )
  }

  if (!payment) {
    throw new HttpError('Vé chưa có dữ liệu thanh toán', 409)
  }

  if (payment.paymentMethod !== 'PAY_AT_BUS') {
    throw new HttpError(
      'Chỉ xử lý thu tiền cho vé chọn Thanh toán khi lên xe',
      409,
    )
  }
}

const confirmCollectedPayment = async ({
  bookingCode,
  actor,
  confirmed,
  now = new Date(),
}) => {
  if (confirmed !== true) {
    throw new HttpError('Bạn phải xác nhận đã nhận đủ tiền từ khách', 400)
  }

  const normalizedCode = normalizeBookingCode(bookingCode)

  return prisma.$transaction(async (transaction) => {
    await lockBooking(transaction, normalizedCode)

    const booking = await transaction.booking.findUnique({
      where: { bookingCode: normalizedCode },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
      },
    })

    const payment = booking
      ? await getLatestPayment(transaction, booking.id)
      : null

    requirePayAtBusBooking(booking, payment)

    if (payment.status === 'SUCCESS' || booking.paymentStatus === 'SUCCESS') {
      throw new HttpError('Vé này đã được xác nhận thanh toán', 409)
    }

    if (payment.status !== 'PENDING' || booking.paymentStatus !== 'PENDING') {
      throw new HttpError(
        'Trạng thái thanh toán hiện tại không cho phép xác nhận thu tiền',
        409,
      )
    }

    const paymentUpdate = await transaction.payment.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
      },
      data: {
        status: 'SUCCESS',
        amount: booking.totalAmount,
        paidAt: now,
      },
    })

    if (paymentUpdate.count !== 1) {
      throw new HttpError(
        'Thanh toán đã được người khác xử lý. Vui lòng tải lại danh sách vé.',
        409,
      )
    }

    await transaction.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'SUCCESS' },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'PAYMENT_SUCCESS',
        entityType: 'BOOKING',
        entityId: booking.id,
        description: `Xác nhận đã thu ${Number(booking.totalAmount || 0).toLocaleString('vi-VN')} đồng cho vé ${booking.bookingCode}`,
        reason: 'Đã nhận đủ tiền từ khách.',
        metadata: {
          paymentId: payment.id,
          paymentMethod: payment.paymentMethod,
          previousStatus: payment.status,
          newStatus: 'SUCCESS',
          amount: Number(booking.totalAmount || 0),
        },
      },
      transaction,
    )

    return {
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      paymentStatus: 'SUCCESS',
      paymentMethod: payment.paymentMethod,
      amount: Number(booking.totalAmount || 0),
      paidAt: now,
    }
  }, TRANSACTION_OPTIONS)
}

const undoCollectedPayment = async ({
  bookingCode,
  actor,
  reason,
  now = new Date(),
}) => {
  if (actor?.role !== 'ADMIN') {
    throw new HttpError(
      'Chỉ Chủ xe được hoàn tác xác nhận thu tiền',
      403,
    )
  }

  const normalizedReason = normalizeMultilineText(reason || '')
  if (normalizedReason.length < 5 || normalizedReason.length > 500) {
    throw new HttpError('Lý do hoàn tác phải có từ 5 đến 500 ký tự', 400)
  }

  const normalizedCode = normalizeBookingCode(bookingCode)

  return prisma.$transaction(async (transaction) => {
    await lockBooking(transaction, normalizedCode)

    const booking = await transaction.booking.findUnique({
      where: { bookingCode: normalizedCode },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
      },
    })

    const payment = booking
      ? await getLatestPayment(transaction, booking.id)
      : null

    requirePayAtBusBooking(booking, payment)

    if (payment.status !== 'SUCCESS' || booking.paymentStatus !== 'SUCCESS') {
      throw new HttpError(
        'Vé chưa ở trạng thái Đã thanh toán nên không thể hoàn tác',
        409,
      )
    }

    const previousPaidAt = payment.paidAt

    const paymentUpdate = await transaction.payment.updateMany({
      where: {
        id: payment.id,
        status: 'SUCCESS',
      },
      data: {
        status: 'PENDING',
        amount: booking.totalAmount,
        paidAt: null,
      },
    })

    if (paymentUpdate.count !== 1) {
      throw new HttpError(
        'Thanh toán đã thay đổi. Vui lòng tải lại danh sách vé.',
        409,
      )
    }

    await transaction.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'PENDING' },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'PAYMENT_PENDING',
        entityType: 'BOOKING',
        entityId: booking.id,
        description: `Hoàn tác xác nhận thu tiền cho vé ${booking.bookingCode}`,
        reason: normalizedReason,
        metadata: {
          paymentId: payment.id,
          paymentMethod: payment.paymentMethod,
          previousStatus: 'SUCCESS',
          newStatus: 'PENDING',
          previousPaidAt,
          undoneAt: now,
        },
      },
      transaction,
    )

    return {
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      paymentStatus: 'PENDING',
      paymentMethod: payment.paymentMethod,
      amount: Number(booking.totalAmount || 0),
      paidAt: null,
      reason: normalizedReason,
    }
  }, TRANSACTION_OPTIONS)
}

export {
  confirmCollectedPayment,
  undoCollectedPayment,
}
