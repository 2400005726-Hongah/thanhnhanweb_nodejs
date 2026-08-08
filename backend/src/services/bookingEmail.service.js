import prisma from '../config/prisma.js'
import { buildBookingEmail } from '../templates/bookingEmail.template.js'
import HttpError from '../utils/HttpError.js'
import { normalizeBookingCode } from '../utils/normalize.js'
import { writeAuditLog } from './auditLog.service.js'
import { sendEmail } from './emailTransport.service.js'

const writeEmailAuditSafely = async (payload) => {
  try {
    await writeAuditLog(payload, prisma)
  } catch (error) {
    console.error(
      `Không thể ghi AuditLog Email (${error.code || error.name || 'UNKNOWN_ERROR'})`,
    )
  }
}

const sendBookingEmailAfterCommit = async (
  booking,
  actor = null,
  transporter,
) => {
  if (!booking.passenger?.email) {
    return {
      emailSent: false,
      emailStatus: 'SKIPPED',
      emailWarning: null,
    }
  }

  const auditBase = {
    userId: actor?.id || null,
    role: actor?.role || null,
    actorName: actor?.fullName,
    entityType: 'BOOKING',
    entityId: booking.id,
    metadata: {
      bookingId: booking.id,
      paymentId: booking.payment?.id || null,
      paymentMethod: booking.payment?.paymentMethod || null,
      paymentStatus: booking.paymentStatus,
    },
  }

  try {
    const message = buildBookingEmail(booking)
    const result = await sendEmail(
      {
        to: booking.passenger.email,
        ...message,
      },
      transporter,
    )

    if (!result.sent) {
      await writeEmailAuditSafely({
        ...auditBase,
        action: 'EMAIL_FAILED',
        description: 'Email vé chưa gửi do dịch vụ Email chưa sẵn sàng',
        metadata: {
          ...auditBase.metadata,
          reasonCode: result.reasonCode,
        },
      })
      console.warn(
        `Email vé chưa gửi cho booking ${booking.bookingCode} (${result.reasonCode})`,
      )
      return {
        emailSent: false,
        emailStatus: 'FAILED',
        emailWarning: 'Đặt vé thành công nhưng Email vé chưa được gửi.',
      }
    }

    await writeEmailAuditSafely({
      ...auditBase,
      action: 'EMAIL_SENT',
      description: 'Đã gửi Email vé điện tử',
    })
    return { emailSent: true, emailStatus: 'SENT', emailWarning: null }
  } catch (error) {
    const reasonCode = error.code || error.name || 'EMAIL_SEND_ERROR'
    console.error(
      `Gửi Email vé thất bại cho booking ${booking.bookingCode} (${reasonCode})`,
    )
    await writeEmailAuditSafely({
      ...auditBase,
      action: 'EMAIL_FAILED',
      description: 'Gửi Email vé điện tử thất bại',
      metadata: { ...auditBase.metadata, reasonCode },
    })
    return {
      emailSent: false,
      emailStatus: 'FAILED',
      emailWarning: 'Đặt vé thành công nhưng Email vé chưa được gửi.',
    }
  }
}


const bookingEmailInclude = {
  trip: {
    include: {
      route: {
        include: {
          departureLocation: true,
          arrivalLocation: true,
        },
      },
      bus: true,
    },
  },
  items: {
    orderBy: { seatCode: 'asc' },
  },
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
}

const serializeBookingForEmail = (booking) => ({
  id: booking.id,
  bookingCode: booking.bookingCode,
  source: booking.source,
  paymentStatus: booking.paymentStatus,
  totalAmount: Number(booking.totalAmount || 0),
  pickupPoint: booking.pickupPoint,
  dropoffPoint: booking.dropoffPoint,
  passenger: {
    fullName: booking.passengerFullName,
    phone: booking.passengerPhone,
    email: booking.passengerEmail,
  },
  trip: {
    id: booking.trip.id,
    departureTime: booking.trip.departureTime,
    expectedArrivalTime: booking.trip.expectedArrivalTime,
    route: booking.trip.route,
    bus: booking.trip.bus,
  },
  seats: booking.items.map((item) => ({
    id: item.tripSeatId,
    seatCode: item.seatCode,
    seatType: item.seatType,
    price: Number(item.price || 0),
  })),
  payment: booking.payments[0]
    ? {
        ...booking.payments[0],
        amount: Number(booking.payments[0].amount || 0),
      }
    : null,
})

const resendBookingEmail = async (bookingCode, actor = null, transporter) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: normalizeBookingCode(bookingCode) },
    include: bookingEmailInclude,
  })

  if (!booking) {
    throw new HttpError('Không tìm thấy vé', 404)
  }
  if (!booking.passengerEmail) {
    throw new HttpError('Vé chưa có địa chỉ email để gửi', 409)
  }

  return sendBookingEmailAfterCommit(
    serializeBookingForEmail(booking),
    actor,
    transporter,
  )
}

const attachEmailDelivery = async (bookingResult, actor, transporter) => {
  const delivery = await sendBookingEmailAfterCommit(
    bookingResult.booking,
    actor,
    transporter,
  )
  return {
    ...bookingResult,
    ...delivery,
    booking: { ...bookingResult.booking, ...delivery },
  }
}

export {
  attachEmailDelivery,
  resendBookingEmail,
  sendBookingEmailAfterCommit,
  serializeBookingForEmail,
}
