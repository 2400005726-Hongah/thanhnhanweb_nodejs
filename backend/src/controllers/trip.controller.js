import {
  cancelTrip,
  changeTripStatus as changeTripStatusService,
  createTrip as createTripService,
  getTripById,
  getTrips,
  updateTrip as updateTripService,
} from '../services/trip.service.js'
import { hasPermission, PERMISSIONS } from '../config/permissions.js'

const canManageTrips = (request) =>
  hasPermission(request.user?.role, PERMISSIONS.VIEW_TRIPS)

const listTrips = async (request, response, next) => {
  try {
    const data = await getTrips({ query: request.query, isAdmin: canManageTrips(request) })
    response.status(200).json({ success: true, message: 'Lấy danh sách chuyến xe thành công', data })
  } catch (error) {
    next(error)
  }
}

const showTrip = async (request, response, next) => {
  try {
    const trip = await getTripById({ tripId: request.params.id, isAdmin: canManageTrips(request) })
    response.status(200).json({ success: true, message: 'Lấy chuyến xe thành công', data: { trip } })
  } catch (error) {
    next(error)
  }
}

const createTrip = async (request, response, next) => {
  try {
    const trip = await createTripService(request.body, request.user.id, request.user)
    response.status(201).json({ success: true, message: 'Tạo chuyến xe và danh sách ghế thành công', data: { trip } })
  } catch (error) {
    next(error)
  }
}

const updateTrip = async (request, response, next) => {
  try {
    const trip = await updateTripService(request.params.id, request.body, request.user)
    response.status(200).json({ success: true, message: 'Cập nhật chuyến xe thành công', data: { trip } })
  } catch (error) {
    next(error)
  }
}

const changeTripStatus = async (request, response, next) => {
  try {
    const trip = await changeTripStatusService(
      request.params.id,
      request.body.status,
      request.user,
    )
    response.status(200).json({ success: true, message: 'Cập nhật trạng thái chuyến thành công', data: { trip } })
  } catch (error) {
    next(error)
  }
}

const deleteTrip = async (request, response, next) => {
  try {
    const trip = await cancelTrip(request.params.id, request.user)
    response.status(200).json({ success: true, message: 'Hủy chuyến xe thành công', data: { trip } })
  } catch (error) {
    next(error)
  }
}

export { changeTripStatus, createTrip, deleteTrip, listTrips, showTrip, updateTrip }
