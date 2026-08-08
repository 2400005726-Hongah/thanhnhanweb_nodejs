import { Router } from 'express'

import {
  changeTripStatus,
  createTrip,
  deleteTrip,
  showTripPassengers,
  showTripCompletionPreview,
  listTrips,
  showTrip,
  updateTrip,
} from '../controllers/trip.controller.js'
import {
  authenticate,
  authorizePermissions,
  optionalAuthenticate,
} from '../middlewares/auth.middleware.js'
import { PERMISSIONS } from '../config/permissions.js'
import validate from '../middlewares/validate.middleware.js'
import {
  changeTripStatusValidator,
  createTripValidator,
  listTripValidator,
  tripIdValidator,
  updateTripValidator,
} from '../validators/trip.validator.js'

const router = Router()

router.get('/', optionalAuthenticate, listTripValidator, validate, listTrips)
router.get(
  '/:id/completion-preview',
  authenticate,
  authorizePermissions(
    PERMISSIONS.EDIT_TRIPS,
  ),
  tripIdValidator,
  validate,
  showTripCompletionPreview,
)
router.get(
  '/:id/passengers',
  authenticate,
  authorizePermissions(
    PERMISSIONS.VIEW_BOOKINGS,
  ),
  tripIdValidator,
  validate,
  showTripPassengers,
)
router.get('/:id', optionalAuthenticate, tripIdValidator, validate, showTrip)
router.post(
  '/',
  authenticate,
  authorizePermissions(PERMISSIONS.CREATE_TRIPS),
  createTripValidator,
  validate,
  createTrip,
)
router.patch(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.EDIT_TRIPS),
  updateTripValidator,
  validate,
  updateTrip,
)
router.patch(
  '/:id/status',
  authenticate,
  authorizePermissions(PERMISSIONS.EDIT_TRIPS),
  changeTripStatusValidator,
  validate,
  changeTripStatus,
)
router.delete(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.DELETE_TRIPS),
  tripIdValidator,
  validate,
  deleteTrip,
)

export default router
