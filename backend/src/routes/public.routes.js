import { Router } from 'express'

import { listPublicNews, showPublicNews } from '../controllers/news.controller.js'
import { listPublicBusTypeImages } from '../controllers/busTypeImage.controller.js'

import {
  cancelGuestBooking,
  createBooking,
  holdSeats,
  releaseSeatHold,
} from '../controllers/booking.controller.js'
import {
  lookupBooking,
  simulatePayment,
} from '../controllers/payment.controller.js'
import {
  getPublicLocations,
  getPublicTripDetail,
  getPublicTripSearchCatalog,
  getPublicTripServicePoints,
  getPublicTripSeats,
  searchPublicTrips,
} from '../controllers/publicTrip.controller.js'
import { optionalAuthenticate } from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  cancelGuestBookingValidator,
  createBookingValidator,
  holdSeatsValidator,
  releaseSeatHoldValidator,
} from '../validators/booking.validator.js'
import {
  publicLocationValidator,
  publicTripIdValidator,
  searchTripValidator,
} from '../validators/publicTrip.validator.js'
import {
  lookupBookingValidator,
  simulatePaymentValidator,
} from '../validators/payment.validator.js'

const router = Router()

router.get('/news', listPublicNews)
router.get('/news/:id', showPublicNews)
router.get('/bus-type-images/:busType', listPublicBusTypeImages)
router.get('/locations', publicLocationValidator, validate, getPublicLocations)
router.get('/search/catalog', getPublicTripSearchCatalog)
router.get('/trips/search', searchTripValidator, validate, searchPublicTrips)
router.get('/bookings/lookup', lookupBookingValidator, validate, lookupBooking)
router.post(
  '/bookings/:bookingCode/cancel',
  cancelGuestBookingValidator,
  validate,
  cancelGuestBooking,
)
router.post(
  '/bookings/:bookingCode/payments/simulate',
  simulatePaymentValidator,
  validate,
  simulatePayment,
)
router.post('/trips/:tripId/seats/hold', holdSeatsValidator, validate, holdSeats)
router.delete(
  '/trips/:tripId/seats/hold',
  releaseSeatHoldValidator,
  validate,
  releaseSeatHold,
)
router.post(
  '/bookings',
  createBookingValidator,
  validate,
  optionalAuthenticate,
  createBooking,
)
router.get('/trips/:tripId/service-points', publicTripIdValidator, validate, getPublicTripServicePoints)
router.get('/trips/:tripId', publicTripIdValidator, validate, getPublicTripDetail)
router.get('/trips/:tripId/seats', publicTripIdValidator, validate, getPublicTripSeats)

export default router
