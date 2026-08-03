import prisma from '../config/prisma.js'
import { buildBookingEmail } from '../templates/bookingEmail.template.js'
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

export { attachEmailDelivery, sendBookingEmailAfterCommit }
