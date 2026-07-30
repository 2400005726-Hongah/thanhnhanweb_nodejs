import { Router } from 'express'

import {
  createLocation,
  deleteLocation,
  listLocations,
  showLocation,
  updateLocation,
} from '../controllers/location.controller.js'
import {
  authenticate,
  authorizeRoles,
  optionalAuthenticate,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  createLocationValidator,
  listLocationValidator,
  locationIdValidator,
  updateLocationValidator,
} from '../validators/location.validator.js'

const router = Router()
const adminOnly = [authenticate, authorizeRoles('ADMIN')]

router.get('/', optionalAuthenticate, listLocationValidator, validate, listLocations)
router.get('/:id', optionalAuthenticate, locationIdValidator, validate, showLocation)
router.post('/', adminOnly, createLocationValidator, validate, createLocation)
router.patch('/:id', adminOnly, updateLocationValidator, validate, updateLocation)
router.delete('/:id', adminOnly, locationIdValidator, validate, deleteLocation)

export default router

