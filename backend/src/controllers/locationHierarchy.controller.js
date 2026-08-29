import { hasPermission, PERMISSIONS } from '../config/permissions.js'
import {
  createArea,
  createProvince,
  createSpecificLocation,
  getLocationCatalog,
  listAreas,
  listProvinces,
  listSpecificLocations,
  softDeleteArea,
  softDeleteSpecificLocation,
  updateArea,
  updateProvince,
  updateSpecificLocation,
} from '../services/locationHierarchy.service.js'

const canManageCatalog = (request) =>
  hasPermission(request.user?.role, PERMISSIONS.EDIT_ROUTES)

const showLocationCatalog = async (request, response, next) => {
  try {
    const data = await getLocationCatalog({ includeInactive: canManageCatalog(request) })
    response.status(200).json({
      success: true,
      message: 'Lấy danh mục địa điểm thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const showProvinces = async (request, response, next) => {
  try {
    const provinces = await listProvinces({ includeInactive: canManageCatalog(request) })
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách tỉnh/thành thành công',
      data: { provinces },
    })
  } catch (error) {
    next(error)
  }
}

const storeProvince = async (request, response, next) => {
  try {
    const province = await createProvince(request.body, request.user)
    response.status(201).json({
      success: true,
      message: 'Thêm tỉnh/thành thành công',
      data: { province },
    })
  } catch (error) {
    next(error)
  }
}

const patchProvince = async (request, response, next) => {
  try {
    const province = await updateProvince(
      request.params.provinceId,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật tỉnh/thành thành công',
      data: { province },
    })
  } catch (error) {
    next(error)
  }
}

const showAreas = async (request, response, next) => {
  try {
    const areas = await listAreas({
      provinceId: request.query.provinceId,
      includeInactive: canManageCatalog(request),
    })
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách khu vực thành công',
      data: { areas },
    })
  } catch (error) {
    next(error)
  }
}

const storeArea = async (request, response, next) => {
  try {
    const area = await createArea(request.body, request.user)
    response.status(201).json({
      success: true,
      message: 'Thêm khu vực/bộ lọc thành công',
      data: { area },
    })
  } catch (error) {
    next(error)
  }
}

const patchArea = async (request, response, next) => {
  try {
    const area = await updateArea(request.params.areaId, request.body, request.user)
    response.status(200).json({
      success: true,
      message: 'Cập nhật khu vực/bộ lọc thành công',
      data: { area },
    })
  } catch (error) {
    next(error)
  }
}


const showSpecificLocations = async (request, response, next) => {
  try {
    const locations = await listSpecificLocations({
      provinceId: request.query.provinceId,
      usageType: request.query.usageType,
      includeInactive: canManageCatalog(request),
    })
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách địa điểm cụ thể thành công',
      data: { locations },
    })
  } catch (error) {
    next(error)
  }
}

const storeSpecificLocation = async (request, response, next) => {
  try {
    const location = await createSpecificLocation(request.body, request.user)
    response.status(201).json({
      success: true,
      message: 'Thêm địa điểm cụ thể thành công',
      data: { location },
    })
  } catch (error) {
    next(error)
  }
}

const patchSpecificLocation = async (request, response, next) => {
  try {
    const location = await updateSpecificLocation(
      request.params.locationId,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật địa điểm cụ thể thành công',
      data: { location },
    })
  } catch (error) {
    next(error)
  }
}

const removeArea = async (request, response, next) => {
  try {
    const area = await softDeleteArea(request.params.areaId, request.user)
    response.status(200).json({
      success: true,
      message: 'Xóa mềm bộ lọc địa điểm thành công',
      data: { area },
    })
  } catch (error) {
    next(error)
  }
}

const removeSpecificLocation = async (request, response, next) => {
  try {
    const location = await softDeleteSpecificLocation(
      request.params.locationId,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Xóa mềm địa điểm cụ thể thành công',
      data: { location },
    })
  } catch (error) {
    next(error)
  }
}

export {
  patchArea,
  patchProvince,
  patchSpecificLocation,
  removeArea,
  removeSpecificLocation,
  showAreas,
  showLocationCatalog,
  showProvinces,
  showSpecificLocations,
  storeArea,
  storeProvince,
  storeSpecificLocation,
}
