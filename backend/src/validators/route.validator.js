import { body, param, query } from 'express-validator'

import {
  normalizeMoneyValue,
  normalizeRouteName,
  normalizeWhitespace,
} from '../utils/normalize.js'

const routeIdValidator = [
  param('id').isUUID().withMessage('ID tuyến xe không hợp lệ'),
]

const listRouteValidator = [
  query('departureLocation')
    .optional()
    .isUUID()
    .withMessage('Điểm đi không hợp lệ'),
  query('arrivalLocation')
    .optional()
    .isUUID()
    .withMessage('Điểm đến không hợp lệ'),
  query('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái không hợp lệ'),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]

const priceRule = (field, label) =>
  body(field)
    .optional({ nullable: true })
    .customSanitizer(normalizeMoneyValue)
    .isInt({ min: 0 })
    .withMessage(`${label} phải là số nguyên không âm`)
    .toInt()

const routeBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)

  return [
    applyOptional(body('routeName'))
      .customSanitizer(normalizeRouteName)
      .notEmpty()
      .withMessage('Tên tuyến là bắt buộc')
      .isLength({ min: 3, max: 200 }),
    applyOptional(body('departureLocation'))
      .isUUID()
      .withMessage('Điểm đi không hợp lệ'),
    applyOptional(body('arrivalLocation'))
      .isUUID()
      .withMessage('Điểm đến không hợp lệ'),
    applyOptional(body('distanceKm'))
      .isFloat({ gt: 0, max: 5000 })
      .withMessage('Khoảng cách phải lớn hơn 0 và không vượt quá 5.000 km')
      .toFloat(),
    applyOptional(body('estimatedDurationMinutes'))
      .isInt({ min: 1, max: 10080 })
      .withMessage('Thời gian dự kiến phải từ 1 phút đến 7 ngày')
      .toInt(),
    priceRule('defaultTicketPrice', 'Giá vé mặc định'),
    priceRule('defaultSingleRoomPrice', 'Giá phòng đơn mặc định'),
    priceRule('defaultDoubleRoomPrice', 'Giá phòng đôi mặc định'),
    body('status')
      .optional()
      .isIn(['ACTIVE', 'INACTIVE'])
      .withMessage('Trạng thái không hợp lệ'),
  ]
}

const createRouteValidator = routeBodyRules(false)
const updateRouteValidator = [...routeIdValidator, ...routeBodyRules(true)]

export {
  createRouteValidator,
  listRouteValidator,
  routeIdValidator,
  updateRouteValidator,
}
