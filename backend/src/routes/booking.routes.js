import { Router } from 'express'

import {
  cancelMyBooking,
  listMyBookings,
} from '../controllers/booking.controller.js'
import {
  authenticate,
  authorizeRoles,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  cancelMyBookingValidator,
  listMyBookingsValidator,
} from '../validators/booking.validator.js'

const router = Router()

router.use(authenticate, authorizeRoles('CUSTOMER'))
router.get('/me', listMyBookingsValidator, validate, listMyBookings)
router.post(
  '/:bookingCode/cancel',
  cancelMyBookingValidator,
  validate,
  cancelMyBooking,
)

export default router
