import { Router } from 'express'

import {
  createRoute,
  deleteRoute,
  listRoutes,
  showRoute,
  updateRoute,
} from '../controllers/route.controller.js'
import {
  authenticate,
  authorizePermissions,
  optionalAuthenticate,
} from '../middlewares/auth.middleware.js'
import { PERMISSIONS } from '../config/permissions.js'
import validate from '../middlewares/validate.middleware.js'
import {
  createRouteValidator,
  listRouteValidator,
  routeIdValidator,
  updateRouteValidator,
} from '../validators/route.validator.js'

const router = Router()

router.get('/', optionalAuthenticate, listRouteValidator, validate, listRoutes)
router.get('/:id', optionalAuthenticate, routeIdValidator, validate, showRoute)
router.post(
  '/',
  authenticate,
  authorizePermissions(PERMISSIONS.CREATE_ROUTES),
  createRouteValidator,
  validate,
  createRoute,
)
router.patch(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.EDIT_ROUTES),
  updateRouteValidator,
  validate,
  updateRoute,
)
router.delete(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.DELETE_ROUTES),
  routeIdValidator,
  validate,
  deleteRoute,
)

export default router
