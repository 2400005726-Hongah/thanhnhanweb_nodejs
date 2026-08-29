import { Router } from 'express'

import {
  listRouteSummary,
  listRoutes,
  showRoute,
} from '../controllers/route.controller.js'
import { showRouteStops } from '../controllers/routeStop.controller.js'
import {
  authenticate,
  authorizePermissions,
  optionalAuthenticate,
} from '../middlewares/auth.middleware.js'
import { PERMISSIONS } from '../config/permissions.js'
import validate from '../middlewares/validate.middleware.js'
import {
  listRouteValidator,
  routeIdValidator,
} from '../validators/route.validator.js'

const router = Router()

router.get('/', optionalAuthenticate, listRouteValidator, validate, listRoutes)
router.get(
  '/summary',
  authenticate,
  authorizePermissions(PERMISSIONS.VIEW_ROUTES),
  listRouteSummary,
)
router.get(
  '/:id/stops',
  optionalAuthenticate,
  routeIdValidator,
  validate,
  showRouteStops,
)
const legacyRouteWriteGone = (_req, res) =>
  res.status(410).json({
    success: false,
    message:
      'Quản lý Tuyến xe kiểu cũ đã ngừng sử dụng. Tuyến xe hiện được tổng hợp tự động từ các Chuyến xe.',
  })

router.put(
  '/:id/stops',
  authenticate,
  authorizePermissions(PERMISSIONS.EDIT_ROUTES),
  routeIdValidator,
  validate,
  legacyRouteWriteGone,
)
router.get('/:id', optionalAuthenticate, routeIdValidator, validate, showRoute)
router.post(
  '/',
  authenticate,
  authorizePermissions(PERMISSIONS.CREATE_ROUTES),
  legacyRouteWriteGone,
)
router.patch(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.EDIT_ROUTES),
  routeIdValidator,
  validate,
  legacyRouteWriteGone,
)
router.delete(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.DELETE_ROUTES),
  routeIdValidator,
  validate,
  legacyRouteWriteGone,
)

export default router
