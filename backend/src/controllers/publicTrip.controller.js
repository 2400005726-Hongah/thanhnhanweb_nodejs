import {
  getPublicLocations as getPublicLocationsService,
  getPublicTripDetail as getPublicTripDetailService,
  getPublicTripSeats as getPublicTripSeatsService,
  searchPublicTrips as searchPublicTripsService,
} from '../services/publicTrip.service.js'

const getPublicLocations = async (request, response, next) => {
  try {
    const data = await getPublicLocationsService(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách địa điểm thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const searchPublicTrips = async (request, response, next) => {
  try {
    const data = await searchPublicTripsService(request.query)
    response.status(200).json({
      success: true,
      message: 'Tìm chuyến xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const getPublicTripDetail = async (request, response, next) => {
  try {
    const data = await getPublicTripDetailService(request.params.tripId)
    response.status(200).json({
      success: true,
      message: 'Lấy chi tiết chuyến xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const getPublicTripSeats = async (request, response, next) => {
  try {
    const data = await getPublicTripSeatsService(request.params.tripId)
    response.status(200).json({
      success: true,
      message: 'Lấy sơ đồ ghế thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export {
  getPublicLocations,
  getPublicTripDetail,
  getPublicTripSeats,
  searchPublicTrips,
}
