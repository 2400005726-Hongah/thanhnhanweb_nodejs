import {
  createBooking as createBookingService,
  holdSeats as holdSeatsService,
  releaseSeatHold as releaseSeatHoldService,
} from '../services/booking.service.js'
import { listMyBookings as listMyBookingsService } from '../services/bookingHistory.service.js'
import { cancelBooking as cancelBookingService } from '../services/cancellation.service.js'

const holdSeats = async (request, response, next) => {
  try {
    const data = await holdSeatsService(
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

const createBooking = async (request, response, next) => {
  try {
    const data = await createBookingService(
      request.body,
      request.user?.id,
      { source: 'ONLINE', actor: request.user || null },
    )
    response.status(201).json({
      success: true,
      message: 'Tạo booking thành công',
      data,
    })
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
    response.status(201).json({
      success: true,
      message: 'Tạo booking quản trị thành công',
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
