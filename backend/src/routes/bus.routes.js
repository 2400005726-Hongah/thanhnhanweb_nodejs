import { Router } from 'express'

import {
  addBusSeat,
  createBus,
  deleteBus,
  deleteBusSeat,
  listBuses,
  listBusSeats,
  showBus,
  updateBus,
  updateBusSeat,
} from '../controllers/bus.controller.js'
import { PERMISSIONS } from '../config/permissions.js'
import {
  authenticate,
  authorizePermissions,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  addSeatValidator,
  busIdValidator,
  busSeatParamsValidator,
  createBusValidator,
  listBusValidator,
  updateBusValidator,
  updateSeatValidator,
} from '../validators/bus.validator.js'

const router = Router()

router.use(authenticate)

router.get(
  '/',
  authorizePermissions(PERMISSIONS.VIEW_BUSES),
  listBusValidator,
  validate,
  listBuses,
)
router.get(
  '/:id',
  authorizePermissions(PERMISSIONS.VIEW_BUSES),
  busIdValidator,
  validate,
  showBus,
)
router.post(
  '/',
  authorizePermissions(PERMISSIONS.MANAGE_BUSES),
  createBusValidator,
  validate,
  createBus,
)
router.patch(
  '/:id',
  authorizePermissions(PERMISSIONS.MANAGE_BUSES),
  updateBusValidator,
  validate,
  updateBus,
)
router.delete(
  '/:id',
  authorizePermissions(PERMISSIONS.MANAGE_BUSES),
  busIdValidator,
  validate,
  deleteBus,
)
router.get(
  '/:busId/seats',
  authorizePermissions(PERMISSIONS.VIEW_BUSES),
  busSeatParamsValidator,
  validate,
  listBusSeats,
)
router.post(
  '/:busId/seats',
  authorizePermissions(PERMISSIONS.MANAGE_BUSES),
  addSeatValidator,
  validate,
  addBusSeat,
)
router.patch(
  '/:busId/seats/:seatId',
  authorizePermissions(PERMISSIONS.MANAGE_BUSES),
  updateSeatValidator,
  validate,
  updateBusSeat,
)
router.delete(
  '/:busId/seats/:seatId',
  authorizePermissions(PERMISSIONS.MANAGE_BUSES),
  busSeatParamsValidator,
  validate,
  deleteBusSeat,
)

export default router
