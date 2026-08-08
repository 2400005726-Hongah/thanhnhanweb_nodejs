import {
  createRoute as createRouteService,
  deactivateRoute,
  getRouteById,
  getRoutes,
  updateRoute as updateRouteService,
} from '../services/route.service.js'
import { hasPermission, PERMISSIONS } from '../config/permissions.js'

const canManageRoutes = (request) =>
  hasPermission(request.user?.role, PERMISSIONS.VIEW_ROUTES)

const listRoutes = async (request, response, next) => {
  try {
    const data = await getRoutes({ query: request.query, isAdmin: canManageRoutes(request) })
    response.status(200).json({ success: true, message: 'Lấy danh sách tuyến xe thành công', data })
  } catch (error) {
    next(error)
  }
}

const showRoute = async (request, response, next) => {
  try {
    const route = await getRouteById({ routeId: request.params.id, isAdmin: canManageRoutes(request) })
    response.status(200).json({ success: true, message: 'Lấy tuyến xe thành công', data: { route } })
  } catch (error) {
    next(error)
  }
}

const createRoute = async (request, response, next) => {
  try {
    const route = await createRouteService(request.body, request.user)
    response.status(201).json({ success: true, message: 'Tạo tuyến xe thành công', data: { route } })
  } catch (error) {
    next(error)
  }
}

const updateRoute = async (request, response, next) => {
  try {
    const route = await updateRouteService(
      request.params.id,
      request.body,
      request.user,
    )
    response.status(200).json({ success: true, message: 'Cập nhật tuyến xe thành công', data: { route } })
  } catch (error) {
    next(error)
  }
}

const deleteRoute = async (request, response, next) => {
  try {
    const route = await deactivateRoute(request.params.id, request.user)
    response.status(200).json({ success: true, message: 'Ngừng hoạt động tuyến xe thành công', data: { route } })
  } catch (error) {
    next(error)
  }
}

export { createRoute, deleteRoute, listRoutes, showRoute, updateRoute }
