import {
  cancelTrip,
  changeTripStatus as changeTripStatusService,
  createTrip as createTripService,
  getTripById,
  getTripSeatMap,
  getTripCompletionPreview,
  getTripPassengerList,
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

const showTripSeatMap = async (
  request,
  response,
  next,
) => {
  try {
    const data =
      await getTripSeatMap(
        request.params.id,
      )

    response.status(200).json({
      success: true,
      message: 'Lấy sơ đồ ghế chuyến xe thành công',
      data,
    })
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
      {
        confirmCollectUnpaid:
          request.body.confirmCollectUnpaid === true,
      },
    )
    response.status(200).json({ success: true, message: 'Cập nhật trạng thái chuyến thành công', data: { trip } })
  } catch (error) {
    next(error)
  }
}

const showTripCompletionPreview = async (
  request,
  response,
  next,
) => {
  try {
    const preview =
      await getTripCompletionPreview(
        request.params.id,
      )

    response.status(200).json({
      success: true,
      message: 'Kiểm tra điều kiện hoàn thành chuyến thành công',
      data: { preview },
    })
  } catch (error) {
    next(error)
  }
}

const showTripPassengers = async (
  request,
  response,
  next,
) => {
  try {
    const data = await getTripPassengerList(
      request.params.id,
      request.user,
    )

    response.status(200).json({
      success: true,
      message: 'Lấy danh sách hành khách thành công',
      data,
    })
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

export {
  changeTripStatus,
  createTrip,
  deleteTrip,
  listTrips,
  showTrip,
  showTripSeatMap,
  showTripCompletionPreview,
  showTripPassengers,
  updateTrip,
}
