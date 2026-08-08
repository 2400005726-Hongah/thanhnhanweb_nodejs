import {
  createLocation as createLocationService,
  deactivateLocation,
  getLocationById,
  getLocations,
  updateLocation as updateLocationService,
} from '../services/location.service.js'

const listLocations = async (request, response, next) => {
  try {
    const data = await getLocations({
      query: request.query,
      isAdmin: request.user?.role === 'ADMIN',
    })
    response.status(200).json({ success: true, message: 'Lấy danh sách địa điểm thành công', data })
  } catch (error) {
    next(error)
  }
}

const showLocation = async (request, response, next) => {
  try {
    const location = await getLocationById({
      locationId: request.params.id,
      isAdmin: request.user?.role === 'ADMIN',
    })
    response.status(200).json({ success: true, message: 'Lấy địa điểm thành công', data: { location } })
  } catch (error) {
    next(error)
  }
}

const createLocation = async (request, response, next) => {
  try {
    const location = await createLocationService(request.body)
    response.status(201).json({ success: true, message: 'Tạo địa điểm thành công', data: { location } })
  } catch (error) {
    next(error)
  }
}

const updateLocation = async (request, response, next) => {
  try {
    const location = await updateLocationService(request.params.id, request.body)
    response.status(200).json({ success: true, message: 'Cập nhật địa điểm thành công', data: { location } })
  } catch (error) {
    next(error)
  }
}

const deleteLocation = async (request, response, next) => {
  try {
    const location = await deactivateLocation(request.params.id)
    response.status(200).json({ success: true, message: 'Ngừng hoạt động địa điểm thành công', data: { location } })
  } catch (error) {
    next(error)
  }
}

export { createLocation, deleteLocation, listLocations, showLocation, updateLocation }

