import env from '../config/env.js'
import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  normalizeBookingCode,
  normalizeMultilineText,
  normalizePhone,
} from '../utils/normalize.js'
import { writeAuditLog } from './auditLog.service.js'

const CANCELLABLE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED']
const TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable',
  maxWait: 5000,
  timeout: 15000,
}
const MAX_SERIALIZABLE_RETRIES = 3

const normalizeCancellationReason = (reason) => {
  if (typeof reason !== 'string') {
    throw new HttpError('Lý do hủy vé là bắt buộc', 400)
  }

  const normalized = normalizeMultilineText(reason)
  if (normalized.length < 5 || normalized.length > 500) {
    throw new HttpError('Lý do hủy vé phải có từ 5 đến 500 ký tự', 400)
  }

  return normalized
}

const toSafeNumber = (value, fieldName) => {
  const number = Number(value)

  if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number))) {
    throw new HttpError(`Giá trị ${fieldName} không thể chuyển đổi an toàn`, 500)
  }

  return number
}

const getCancellationState = (booking, now = new Date()) => {
  const departureTime = new Date(booking.trip.departureTime)
  const cancelDeadline = new Date(
    departureTime.getTime() -
      env.bookingCancelBeforeMinutes * 60 * 1000,
  )
  const canCancel =
    CANCELLABLE_BOOKING_STATUSES.includes(booking.status) &&
    departureTime > now &&
    now <= cancelDeadline

  return { canCancel, cancelDeadline }
}

const lockBooking = (database, bookingCode) =>
  database.$queryRaw`
    SELECT id
    FROM bookings
    WHERE booking_code = ${bookingCode}
    FOR UPDATE
  `

const lockTripSeats = async (database, tripSeatIds) => {
  for (const tripSeatId of [...tripSeatIds].sort()) {
    await database.$queryRaw`
      SELECT id
      FROM trip_seats
      WHERE id = ${tripSeatId}::uuid
      FOR UPDATE
    `
  }
}

const lockSuccessfulPayments = (database, bookingId) =>
  database.$queryRaw`
    SELECT id
    FROM payments
    WHERE booking_id = ${bookingId}::uuid
      AND status = 'SUCCESS'
    ORDER BY id
    FOR UPDATE
  `

const cancellationBookingSelect = {
  id: true,
  bookingCode: true,
  userId: true,
  status: true,
  paymentStatus: true,
  totalAmount: true,
  trip: {
    select: {
      id: true,
      status: true,
      departureTime: true,
    },
  },
  items: {
    select: { tripSeatId: true },
    orderBy: { tripSeatId: 'asc' },
  },
}

const throwCancellationNotFound = (mode) => {
  const message =
    mode === 'guest'
      ? 'Không thể hủy vé với thông tin đã cung cấp'
      : 'Không tìm thấy booking phù hợp'

  throw new HttpError(message, 404)
}

const ensureBookingCanBeCancelled = (booking, now) => {
  if (!CANCELLABLE_BOOKING_STATUSES.includes(booking.status)) {
    throw new HttpError('Booking không còn ở trạng thái có thể hủy', 409)
  }

  const departureTime = new Date(booking.trip.departureTime)
  if (departureTime <= now) {
    throw new HttpError('Không thể hủy vé sau khi chuyến đã khởi hành', 409)
  }

  const { cancelDeadline } = getCancellationState(booking, now)
  if (now > cancelDeadline) {
    throw new HttpError('Đã quá thời hạn cho phép hủy vé', 409)
  }
}

const runCancellationTransaction = ({
  bookingCode,
  userId,
  phone,
  mode,
  now,
  actor,
  reason,
}) =>
  prisma.$transaction(async (transaction) => {
    await lockBooking(transaction, bookingCode)

    const booking = await transaction.booking.findFirst({
      where: {
        bookingCode,
        ...(mode === 'customer'
          ? { userId }
          : mode === 'guest'
            ? { passengerPhone: phone }
            : {}),
      },
      select: cancellationBookingSelect,
    })

    if (!booking) {
      throwCancellationNotFound(mode)
    }

    ensureBookingCanBeCancelled(booking, now)

    const tripSeatIds = booking.items.map((item) => item.tripSeatId)
    if (tripSeatIds.length === 0) {
      throw new HttpError('Booking không có dữ liệu ghế hợp lệ để hủy', 409)
    }

    await lockTripSeats(transaction, tripSeatIds)
    const tripSeats = await transaction.tripSeat.findMany({
      where: { id: { in: tripSeatIds } },
      select: { id: true, status: true },
      orderBy: { id: 'asc' },
    })

    if (
      tripSeats.length !== tripSeatIds.length ||
      tripSeats.some((tripSeat) => tripSeat.status !== 'BOOKED')
    ) {
      throw new HttpError('Trạng thái ghế của booking không còn hợp lệ', 409)
    }

    await lockSuccessfulPayments(transaction, booking.id)
    const successfulPayments = await transaction.payment.findMany({
      where: { bookingId: booking.id, status: 'SUCCESS' },
      select: { id: true, amount: true },
      orderBy: { id: 'asc' },
    })
    const paymentIds = successfulPayments.map((payment) => payment.id)
    const refunded = paymentIds.length > 0
    const refundAmount = successfulPayments.reduce(
      (total, payment) =>
        total + toSafeNumber(payment.amount, 'số tiền hoàn'),
      0,
    )

    const bookingUpdate = await transaction.booking.updateMany({
      where: {
        id: booking.id,
        status: { in: CANCELLABLE_BOOKING_STATUSES },
      },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: now,
        cancelledById:
          actor?.id || (mode === 'customer' ? userId : null),
        ...(refunded && { paymentStatus: 'REFUNDED' }),
      },
    })
    if (bookingUpdate.count !== 1) {
      throw new HttpError('Booking đã được hủy hoặc không còn hợp lệ', 409)
    }

    const releasedSeats = await transaction.tripSeat.updateMany({
      where: {
        id: { in: tripSeatIds },
        status: 'BOOKED',
      },
      data: {
        status: 'AVAILABLE',
        heldBy: null,
        holdExpiresAt: null,
      },
    })
    if (releasedSeats.count !== tripSeatIds.length) {
      throw new HttpError('Không thể giải phóng đầy đủ ghế của booking', 409)
    }

    if (refunded) {
      const refundedPayments = await transaction.payment.updateMany({
        where: {
          id: { in: paymentIds },
          bookingId: booking.id,
          status: 'SUCCESS',
        },
        data: { status: 'REFUNDED' },
      })
      if (refundedPayments.count !== paymentIds.length) {
        throw new HttpError('Không thể hoàn tiền đầy đủ cho booking', 409)
      }
    }

    await writeAuditLog(
      {
        userId: actor?.id || (mode === 'customer' ? userId : null),
        role: actor?.role || (mode === 'customer' ? 'CUSTOMER' : null),
        actorName:
          actor?.fullName ||
          (mode === 'customer' ? 'Khách hàng' : 'Khách tra cứu vé'),
        action: 'CANCEL_BOOKING',
        entityType: 'BOOKING',
        entityId: booking.id,
        description: `Hủy vé ${booking.bookingCode}`,
        reason,
        metadata: {
          cancellationMode: mode,
          refunded,
          refundAmount,
          releasedSeatCount: releasedSeats.count,
        },
      },
      transaction,
    )

    return {
      bookingCode: booking.bookingCode,
      status: 'CANCELLED',
      paymentStatus: refunded ? 'REFUNDED' : booking.paymentStatus,
      releasedSeatCount: releasedSeats.count,
      refunded,
      refundAmount,
      cancellationReason: reason,
    }
  }, TRANSACTION_OPTIONS)

const cancelBooking = async ({
  bookingCode,
  userId = null,
  phone = null,
  now = new Date(),
  actor = null,
  reason,
}) => {
  const normalizedCode = normalizeBookingCode(bookingCode)
  const normalizedReason = normalizeCancellationReason(reason)
  const mode = actor ? 'manager' : userId ? 'customer' : 'guest'
  const normalizedPhone = mode === 'guest' ? normalizePhone(phone) : null

  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await runCancellationTransaction({
        bookingCode: normalizedCode,
        userId,
        phone: normalizedPhone,
        mode,
        now,
        actor,
        reason: normalizedReason,
      })
    } catch (error) {
      if (error.code !== 'P2034') {
        throw error
      }

      if (attempt === MAX_SERIALIZABLE_RETRIES - 1) {
        throw new HttpError(
          'Yêu cầu hủy vé đang bị xung đột, vui lòng thử lại',
          409,
        )
      }
    }
  }

  throw new HttpError('Không thể xử lý yêu cầu hủy vé', 409)
}

const cancelManagedBooking = ({
  bookingCode,
  actor,
  reason,
  now = new Date(),
}) => cancelBooking({ bookingCode, actor, reason, now })

export {
  CANCELLABLE_BOOKING_STATUSES,
  cancelBooking,
  cancelManagedBooking,
  getCancellationState,
  normalizeBookingCode,
  normalizeCancellationReason,
}
