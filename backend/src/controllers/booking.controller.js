import {
  createBooking as createBookingService,
  holdSeats as holdSeatsService,
  releaseSeatHold as releaseSeatHoldService,
} from '../services/booking.service.js'
import { listMyBookings as listMyBookingsService } from '../services/bookingHistory.service.js'
import { cancelBooking as cancelBookingService } from '../services/cancellation.service.js'
import { attachEmailDelivery } from '../services/bookingEmail.service.js'

const holdSeats = async (request, response, next) => {
  try {
    const roomSelections = request.body.roomSelections || []
    const holdToken = request.body.holdToken || null
    const data = holdToken
      ? await holdSeatsService(
          request.params.tripId,
          request.body.tripSeatIds,
          roomSelections,
          holdToken,
        )
      : roomSelections.length
        ? await holdSeatsService(
            request.params.tripId,
            request.body.tripSeatIds,
            roomSelections,
          )
        : await holdSeatsService(
            request.params.tripId,
            request.body.tripSeatIds,
          )
    response.status(201).json({
      success: true,
      message: 'Giữ ghế thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const releaseSeatHold = async (request, response, next) => {
  try {
    const data = await releaseSeatHoldService(
      request.params.tripId,
      request.body.holdToken,
    )
    response.status(200).json({
      success: true,
      message: 'Đã giải phóng ghế đang giữ',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const queueBookingEmail = (bookingResult, actor) => {
  setImmediate(() => {
    void attachEmailDelivery(bookingResult, actor).catch((error) => {
      console.error(
        `Không thể hoàn tất tác vụ Email sau khi tạo vé (${error?.code || error?.name || 'EMAIL_BACKGROUND_ERROR'})`,
      )
    })
  })
}

const buildImmediateBookingResponse = (bookingResult) => {
  const hasEmail = Boolean(bookingResult.booking?.passenger?.email)
  const emailStatus = hasEmail ? 'QUEUED' : 'SKIPPED'
  const emailWarning = null

  return {
    ...bookingResult,
    emailSent: false,
    emailStatus,
    emailWarning,
    booking: {
      ...bookingResult.booking,
      emailSent: false,
      emailStatus,
      emailWarning,
    },
  }
}

const createBooking = async (request, response, next) => {
  try {
    const bookingResult = await createBookingService(
      request.body,
      request.user?.id,
      { source: 'ONLINE', actor: request.user || null },
    )
    const data = buildImmediateBookingResponse(bookingResult)
    const payAtBus = data.booking.payment?.paymentMethod === 'PAY_AT_BUS'

    // Phản hồi ngay sau khi transaction tạo vé đã commit.
    // Gửi Email chạy sau response để SMTP chậm không làm frontend timeout
    // rồi gửi lại request tạo vé lần hai.
    response.status(201).json({
      success: true,
      message: payAtBus
        ? 'Vé đã được đặt thành công. Quý khách vui lòng thanh toán khi lên xe.'
        : 'Tạo booking và thanh toán mô phỏng thành công',
      data,
    })

    if (!bookingResult.recovered) {
      queueBookingEmail(bookingResult, request.user || null)
    }
  } catch (error) {
    next(error)
  }
}

const createManagedBooking = async (request, response, next) => {
  try {
    const data = await createBookingService(request.body, null, {
      source: request.body.source,
      createdById: request.user.id,
      actor: request.user,
      staffNote: request.body.staffNote,
    })
    const payAtBus = data.booking.payment?.paymentMethod === 'PAY_AT_BUS'
    const hotline = request.body.source === 'HOTLINE'
    response.status(201).json({
      success: true,
      message: hotline
        ? `Đã tạo vé Hotline ${data.booking.bookingCode} và gửi SMS mô phỏng.`
        : payAtBus
          ? 'Vé tại quầy đã được tạo. Khách thanh toán khi lên xe.'
          : 'Tạo vé tại quầy và ghi nhận thanh toán thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const listMyBookings = async (request, response, next) => {
  try {
    const query = {
      ...request.query,
      ...(request.query.page && { page: Number(request.query.page) }),
      ...(request.query.limit && { limit: Number(request.query.limit) }),
    }
    const data = await listMyBookingsService({
      userId: request.user.id,
      ...query,
    })
    response.status(200).json({
      success: true,
      message: 'Lấy lịch sử vé thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const cancelMyBooking = async (request, response, next) => {
  try {
    const data = await cancelBookingService({
      bookingCode: request.params.bookingCode,
      userId: request.user.id,
      reason: request.body.reason,
    })
    response.status(200).json({
      success: true,
      message: 'Hủy vé thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const cancelGuestBooking = async (request, response, next) => {
  try {
    const data = await cancelBookingService({
      bookingCode: request.params.bookingCode,
      phone: request.body.phone,
      reason: request.body.reason,
    })
    response.status(200).json({
      success: true,
      message: 'Hủy vé thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export {
  cancelGuestBooking,
  cancelMyBooking,
  createBooking,
  createManagedBooking,
  holdSeats,
  listMyBookings,
  releaseSeatHold,
}
