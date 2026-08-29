import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { normalizeBookingCode, normalizeMultilineText } from '../utils/normalize.js'
import { writeAuditLog } from './auditLog.service.js'

const DELETABLE_BOOKING_STATUSES = [
  'CONFIRMED',
]

const normalizeDeletionReason = (reason) => {
  if (typeof reason !== 'string') {
    throw new HttpError(
      'Lý do xóa vé là bắt buộc',
      400,
    )
  }

  const normalized = normalizeMultilineText(reason)

  if (
    normalized.length < 5 ||
    normalized.length > 500
  ) {
    throw new HttpError(
      'Lý do xóa vé phải có từ 5 đến 500 ký tự',
      400,
    )
  }

  return normalized
}

const softDeleteManagedBooking = async ({
  bookingCode,
  reason,
  actor,
  now = new Date(),
}) => {
  const normalizedCode =
    normalizeBookingCode(bookingCode)

  const normalizedReason =
    normalizeDeletionReason(reason)

  return prisma.$transaction(
    async (transaction) => {
      const booking =
        await transaction.booking.findUnique({
          where: {
            bookingCode: normalizedCode,
          },

          select: {
            id: true,
            bookingCode: true,
            status: true,
            paymentStatus: true,

            trip: {
              select: {
                departureTime: true,
              },
            },

            items: {
              select: {
                tripSeatId: true,
              },

              orderBy: {
                tripSeatId: 'asc',
              },
            },
          },
        })

      if (!booking) {
        throw new HttpError(
          'Không tìm thấy vé',
          404,
        )
      }

      if (booking.status === 'DELETED') {
        throw new HttpError(
          'Vé này đã được xóa trước đó',
          409,
        )
      }

      if (
        !DELETABLE_BOOKING_STATUSES.includes(
          booking.status,
        )
      ) {
        throw new HttpError(
          'Chỉ vé đang ở trạng thái Đã đặt mới được xóa',
          409,
        )
      }

      if (booking.paymentStatus === 'SUCCESS') {
        throw new HttpError(
          'Vé đã thanh toán nên không thể xóa. Hãy sử dụng chức năng Hủy vé để hoàn tiền.',
          409,
        )
      }

      if (
        new Date(
          booking.trip.departureTime,
        ) <= now
      ) {
        throw new HttpError(
          'Không thể xóa vé sau giờ khởi hành; hãy dùng chức năng Không đi',
          409,
        )
      }

      const tripSeatIds =
        booking.items.map(
          (item) => item.tripSeatId,
        )

      if (tripSeatIds.length === 0) {
        throw new HttpError(
          'Vé không có dữ liệu ghế hợp lệ',
          409,
        )
      }

      const tripSeats =
        await transaction.tripSeat.findMany({
          where: {
            id: {
              in: tripSeatIds,
            },
          },

          select: {
            id: true,
            status: true,
          },
        })

      if (
        tripSeats.length !==
        tripSeatIds.length
      ) {
        throw new HttpError(
          'Không tìm thấy đầy đủ ghế của vé',
          409,
        )
      }

      if (
        tripSeats.some(
          (tripSeat) =>
            tripSeat.status !== 'BOOKED',
        )
      ) {
        throw new HttpError(
          'Trạng thái ghế của vé không còn hợp lệ',
          409,
        )
      }

      const deletedBooking =
        await transaction.booking.updateMany({
          where: {
            id: booking.id,

            status: {
              in: DELETABLE_BOOKING_STATUSES,
            },
          },

          data: {
            status: 'DELETED',
            deletedReason:
              normalizedReason,
            deletedAt: now,
            deletedById:
              actor.id,
          },
        })

      if (deletedBooking.count !== 1) {
        throw new HttpError(
          'Vé đã được xử lý bởi yêu cầu khác',
          409,
        )
      }

      const releasedSeats =
        await transaction.tripSeat.updateMany({
          where: {
            id: {
              in: tripSeatIds,
            },

            status: 'BOOKED',
          },

          data: {
            status: 'AVAILABLE',
            heldBy: null,
            holdExpiresAt: null,
          },
        })

      if (
        releasedSeats.count !==
        tripSeatIds.length
      ) {
        throw new HttpError(
          'Không thể giải phóng đầy đủ ghế của vé',
          409,
        )
      }

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: 'DELETE_BOOKING',
          entityType: 'BOOKING',
          entityId: booking.id,
          description:
            `Xóa mềm vé ${booking.bookingCode}`,
          reason: normalizedReason,

          metadata: {
            previousStatus:
              booking.status,
            newStatus: 'DELETED',
            releasedSeatCount:
              releasedSeats.count,
            paymentStatus:
              booking.paymentStatus,
          },
        },

        transaction,
      )

      return {
        bookingCode:
          booking.bookingCode,
        status: 'DELETED',
        paymentStatus:
          booking.paymentStatus,
        deletedReason:
          normalizedReason,
        deletedAt: now,
        releasedSeatCount:
          releasedSeats.count,
      }
    },
  )
}

export {
  DELETABLE_BOOKING_STATUSES,
  normalizeDeletionReason,
  softDeleteManagedBooking,
}