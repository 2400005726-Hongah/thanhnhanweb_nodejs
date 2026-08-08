import { body, param, query } from 'express-validator'

import {
  normalizeAddress,
  normalizeLocationName,
  normalizeProvince,
  normalizeWhitespace,
} from '../utils/normalize.js'

const locationIdValidator = [
  param('id').isUUID().withMessage('ID địa điểm không hợp lệ'),
]

const listLocationValidator = [
  query('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 100 })
    .withMessage('Từ khóa không được vượt quá 100 ký tự'),
  query('page').optional().isInt({ min: 1 }).withMessage('Trang phải từ 1 trở lên'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Giới hạn phải từ 1 đến 100'),
]

const createLocationValidator = [
  body('name')
    .customSanitizer(normalizeLocationName)
    .notEmpty()
    .withMessage('Tên địa điểm là bắt buộc')
    .isLength({ min: 2, max: 150 })
    .withMessage('Tên địa điểm phải có từ 2 đến 150 ký tự'),
  body('province')
    .customSanitizer(normalizeProvince)
    .notEmpty()
    .withMessage('Tỉnh/thành phố là bắt buộc')
    .isLength({ min: 2, max: 100 }),
  body('address')
    .optional({ nullable: true })
    .customSanitizer(normalizeAddress)
    .isLength({ max: 255 }),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
]

const updateLocationValidator = [
  ...locationIdValidator,
  body('name')
    .optional()
    .customSanitizer(normalizeLocationName)
    .notEmpty()
    .isLength({ min: 2, max: 150 }),
  body('province')
    .optional()
    .customSanitizer(normalizeProvince)
    .notEmpty()
    .isLength({ min: 2, max: 100 }),
  body('address')
    .optional({ nullable: true })
    .customSanitizer(normalizeAddress)
    .isLength({ max: 255 }),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
]

export {
  createLocationValidator,
  listLocationValidator,
  locationIdValidator,
  updateLocationValidator,
}
