import {
  configureTripServicePoints,
  getTripServicePoints,
} from '../services/tripServicePoint.service.js'

const showTripServicePoints = async (request, response, next) => {
  try {
    const data = await getTripServicePoints(request.params.id, {
      includeInactive: Boolean(request.user),
    })
    response.status(200).json({
      success: true,
      message: 'Lấy cấu hình điểm đón/trả của chuyến thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const updateTripServicePoints = async (request, response, next) => {
  try {
    const data = await configureTripServicePoints(
      request.params.id,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật cấu hình điểm đón/trả của chuyến thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export { showTripServicePoints, updateTripServicePoints }
