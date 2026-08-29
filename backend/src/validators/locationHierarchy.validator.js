import { body, param, query } from 'express-validator'

import {
  normalizeAddress,
  normalizeLocationName,
  normalizeProvince,
  normalizeWhitespace,
} from '../utils/normalize.js'

const statusRule = (field = 'status') =>
  body(field).optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ')

const provinceIdParamValidator = [
  param('provinceId').isUUID().withMessage('ID tỉnh/thành không hợp lệ'),
]

const areaIdParamValidator = [
  param('areaId').isUUID().withMessage('ID khu vực không hợp lệ'),
]

const specificLocationIdParamValidator = [
  param('locationId').isUUID().withMessage('ID địa điểm cụ thể không hợp lệ'),
]

const listAreaValidator = [
  query('provinceId').optional().isUUID().withMessage('ID tỉnh/thành không hợp lệ'),
]

const createProvinceValidator = [
  body('name')
    .customSanitizer(normalizeProvince)
    .notEmpty()
    .withMessage('Tên tỉnh/thành là bắt buộc')
    .isLength({ min: 2, max: 100 }),
  statusRule(),
]

const updateProvinceValidator = [
  ...provinceIdParamValidator,
  body('name')
    .optional()
    .customSanitizer(normalizeProvince)
    .notEmpty()
    .isLength({ min: 2, max: 100 }),
  statusRule(),
]

const areaBodyRules = (optional = false) => {
  const maybe = (chain) => (optional ? chain.optional() : chain)
  return [
    maybe(body('provinceId')).isUUID().withMessage('ID tỉnh/thành không hợp lệ'),
    maybe(body('name'))
      .customSanitizer(normalizeWhitespace)
      .notEmpty()
      .isLength({ min: 2, max: 150 }),
    body('legacyRegion')
      .optional({ nullable: true })
      .customSanitizer(normalizeWhitespace)
      .isLength({ max: 100 }),
    body('detailedAddress')
      .optional({ nullable: true })
      .customSanitizer(normalizeAddress)
      .isLength({ max: 300 }),
    body('sortOrder').optional().isInt({ min: 0, max: 100000 }).toInt(),
    statusRule(),
  ]
}

const createAreaValidator = areaBodyRules(false)
const updateAreaValidator = [...areaIdParamValidator, ...areaBodyRules(true)]

const specificLocationBodyRules = (optional = false) => {
  const maybe = (chain) => (optional ? chain.optional() : chain)
  return [
    maybe(body('provinceId')).isUUID().withMessage('ID tỉnh/thành không hợp lệ'),
    maybe(body('defaultAreaId')).isUUID().withMessage('ID bộ lọc mặc định không hợp lệ'),
    body('filterAreaIds')
      .optional()
      .isArray({ min: 1, max: 100 })
      .withMessage('Bộ lọc áp dụng phải là danh sách có ít nhất một mục'),
    body('filterAreaIds.*')
      .optional()
      .isUUID()
      .withMessage('ID bộ lọc áp dụng không hợp lệ'),
    maybe(body('name'))
      .customSanitizer(normalizeLocationName)
      .notEmpty()
      .isLength({ min: 2, max: 200 }),
    body('address')
      .optional({ nullable: true })
      .customSanitizer(normalizeAddress)
      .isLength({ max: 300 }),
    body('locationType')
      .optional()
      .isIn(['PICKUP', 'DROPOFF', 'BOTH'])
      .withMessage('Loại địa điểm không hợp lệ'),
    statusRule(),
  ]
}

const listSpecificLocationValidator = [
  query('provinceId').optional().isUUID().withMessage('ID tỉnh/thành không hợp lệ'),
  query('usageType')
    .optional()
    .isIn(['PICKUP', 'DROPOFF', 'BOTH'])
    .withMessage('Loại sử dụng địa điểm không hợp lệ'),
]

const createSpecificLocationValidator = specificLocationBodyRules(false)
const updateSpecificLocationValidator = [
  ...specificLocationIdParamValidator,
  ...specificLocationBodyRules(true),
]

export {
  areaIdParamValidator,
  createAreaValidator,
  createProvinceValidator,
  createSpecificLocationValidator,
  listAreaValidator,
  listSpecificLocationValidator,
  provinceIdParamValidator,
  specificLocationIdParamValidator,
  updateAreaValidator,
  updateProvinceValidator,
  updateSpecificLocationValidator,
}
