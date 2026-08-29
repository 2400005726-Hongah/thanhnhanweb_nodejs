import { hasPermission, PERMISSIONS } from '../config/permissions.js'
import {
  configureRouteStops,
  getRouteStops,
} from '../services/routeStop.service.js'

const canManageRouteStops = (request) =>
  hasPermission(request.user?.role, PERMISSIONS.EDIT_ROUTES)

const showRouteStops = async (request, response, next) => {
  try {
    const data = await getRouteStops(request.params.id, {
      includeInactive: canManageRouteStops(request),
    })
    response.status(200).json({
      success: true,
      message: 'Lấy khu vực đón/trả của tuyến thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const replaceRouteStops = async (request, response, next) => {
  try {
    const data = await configureRouteStops(
      request.params.id,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật khu vực đón/trả của tuyến thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export { replaceRouteStops, showRouteStops }
