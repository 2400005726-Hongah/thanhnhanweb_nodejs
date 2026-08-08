import { body, param, query } from 'express-validator'

import { normalizeMoneyValue } from '../utils/normalize.js'

const tripIdValidator = [
  param('id').isUUID().withMessage('ID chuyến xe không hợp lệ'),
]

const listTripValidator = [
  query('route').optional().isUUID().withMessage('ID tuyến không hợp lệ'),
  query('bus').optional().isUUID().withMessage('ID xe không hợp lệ'),
  query('departureDate')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('Ngày khởi hành không hợp lệ'),
  query('status')
    .optional()
    .isIn(['OPEN', 'CLOSED', 'DEPARTED', 'COMPLETED', 'CANCELLED']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['asc', 'desc']),
]

const tripPriceRule = (field, label) =>
  body(field)
    .optional({ nullable: true })
    .customSanitizer(normalizeMoneyValue)
    .isInt({ min: 0 })
    .withMessage(`${label} phải là số nguyên không âm`)
    .toInt()

const tripBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)
  return [
    applyOptional(body('route')).isUUID().withMessage('ID tuyến không hợp lệ'),
    applyOptional(body('bus')).isUUID().withMessage('ID xe không hợp lệ'),
    applyOptional(body('departureTime'))
      .isISO8601()
      .withMessage('Thời gian khởi hành không hợp lệ'),
    applyOptional(body('expectedArrivalTime'))
      .isISO8601()
      .withMessage('Thời gian đến không hợp lệ'),
    tripPriceRule('ticketPrice', 'Giá vé'),
    tripPriceRule('singleRoomPrice', 'Giá phòng đơn'),
    tripPriceRule('doubleRoomPrice', 'Giá phòng đôi'),
  ]
}

const createTripValidator = [
  ...tripBodyRules(false),
  body('status')
    .optional()
    .isIn(['OPEN', 'CLOSED'])
    .withMessage('Trạng thái tạo chuyến không hợp lệ'),
]
const updateTripValidator = [...tripIdValidator, ...tripBodyRules(true)]
const changeTripStatusValidator = [
  ...tripIdValidator,
  body('status')
    .isIn(['OPEN', 'CLOSED', 'DEPARTED', 'COMPLETED', 'CANCELLED'])
    .withMessage('Trạng thái chuyến không hợp lệ'),
  body('confirmCollectUnpaid')
    .optional()
    .isBoolean()
    .withMessage('Xác nhận thu tiền còn lại không hợp lệ'),
]

export {
  changeTripStatusValidator,
  createTripValidator,
  listTripValidator,
  tripIdValidator,
  updateTripValidator,
}
