import { Router } from 'express'

import {
  listLocations,
  showLocation,
} from '../controllers/location.controller.js'
import {
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
} from '../controllers/locationHierarchy.controller.js'
import {
  authenticate,
  authorizePermissions,
  optionalAuthenticate,
} from '../middlewares/auth.middleware.js'
import { PERMISSIONS } from '../config/permissions.js'
import validate from '../middlewares/validate.middleware.js'
import {
  listLocationValidator,
  locationIdValidator,
} from '../validators/location.validator.js'
import {
  areaIdParamValidator,
  createAreaValidator,
  createProvinceValidator,
  createSpecificLocationValidator,
  listAreaValidator,
  listSpecificLocationValidator,
  specificLocationIdParamValidator,
  updateAreaValidator,
  updateProvinceValidator,
  updateSpecificLocationValidator,
} from '../validators/locationHierarchy.validator.js'

const router = Router()
const catalogEditors = [
  authenticate,
  authorizePermissions(PERMISSIONS.EDIT_ROUTES),
]

router.get('/catalog', optionalAuthenticate, showLocationCatalog)
router.get('/provinces', optionalAuthenticate, showProvinces)
router.post('/provinces', catalogEditors, createProvinceValidator, validate, storeProvince)
router.patch(
  '/provinces/:provinceId',
  catalogEditors,
  updateProvinceValidator,
  validate,
  patchProvince,
)
router.get('/areas', optionalAuthenticate, listAreaValidator, validate, showAreas)
router.post('/areas', catalogEditors, createAreaValidator, validate, storeArea)
router.patch('/areas/:areaId', catalogEditors, updateAreaValidator, validate, patchArea)
router.delete('/areas/:areaId', catalogEditors, areaIdParamValidator, validate, removeArea)
router.get('/specific', optionalAuthenticate, listSpecificLocationValidator, validate, showSpecificLocations)
router.post(
  '/specific',
  catalogEditors,
  createSpecificLocationValidator,
  validate,
  storeSpecificLocation,
)
router.patch(
  '/specific/:locationId',
  catalogEditors,
  updateSpecificLocationValidator,
  validate,
  patchSpecificLocation,
)
router.delete(
  '/specific/:locationId',
  catalogEditors,
  specificLocationIdParamValidator,
  validate,
  removeSpecificLocation,
)

const legacyLocationWriteGone = (_req, res) =>
  res.status(410).json({
    success: false,
    message:
      'API địa điểm cũ đã ngừng sử dụng. Hãy quản lý địa điểm cụ thể qua /locations/specific để bảo đảm Tỉnh/Thành, Bộ lọc và Loại địa điểm luôn đồng bộ.',
  })

router.get('/', optionalAuthenticate, listLocationValidator, validate, listLocations)
router.get('/:id', optionalAuthenticate, locationIdValidator, validate, showLocation)
router.post('/', catalogEditors, legacyLocationWriteGone)
router.patch('/:id', catalogEditors, locationIdValidator, validate, legacyLocationWriteGone)
router.delete('/:id', catalogEditors, locationIdValidator, validate, legacyLocationWriteGone)

export default router

