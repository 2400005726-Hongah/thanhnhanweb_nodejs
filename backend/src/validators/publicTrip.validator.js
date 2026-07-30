import { param, query } from 'express-validator'

import { isValidDateOnly, isValidTimeOnly } from '../utils/dateTime.js'

const publicLocationValidator = [
  query('keyword').optional().trim().isLength({ max: 100 }).withMessage('Từ khóa không được vượt quá 100 ký tự'),
]

const searchTripValidator = [
  query('departureLocationId').notEmpty().withMessage('Điểm đi là bắt buộc').isUUID().withMessage('Điểm đi không hợp lệ'),
  query('arrivalLocationId')
    .notEmpty().withMessage('Điểm đến là bắt buộc')
    .isUUID().withMessage('Điểm đến không hợp lệ')
    .custom((value, { req }) => value !== req.query.departureLocationId)
    .withMessage('Điểm đi phải khác điểm đến'),
  query('departureDate')
    .notEmpty().withMessage('Ngày đi là bắt buộc')
    .custom(isValidDateOnly).withMessage('Ngày đi không hợp lệ'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Giá tối thiểu không hợp lệ').toFloat(),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Giá tối đa không hợp lệ')
    .toFloat()
    .custom((value, { req }) => req.query.minPrice === undefined || value >= Number(req.query.minPrice))
    .withMessage('Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu'),
  query('departureTimeFrom').optional().custom(isValidTimeOnly).withMessage('Giờ bắt đầu phải có định dạng HH:mm'),
  query('departureTimeTo')
    .optional()
    .custom(isValidTimeOnly).withMessage('Giờ kết thúc phải có định dạng HH:mm')
    .custom((value, { req }) => !req.query.departureTimeFrom || value >= req.query.departureTimeFrom)
    .withMessage('Giờ kết thúc phải sau giờ bắt đầu'),
  query('busType').optional().isIn(['SEATED', 'SLEEPER', 'LIMOUSINE']).withMessage('Loại xe không hợp lệ'),
  query('sort').optional().isIn(['departureTimeAsc', 'departureTimeDesc', 'priceAsc', 'priceDesc']).withMessage('Kiểu sắp xếp không hợp lệ'),
  query('page').optional().isInt({ min: 1 }).withMessage('Trang phải từ 1 trở lên').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Giới hạn phải từ 1 đến 50').toInt(),
]

const publicTripIdValidator = [
  param('tripId').isUUID().withMessage('ID chuyến xe không hợp lệ'),
]

export { publicLocationValidator, publicTripIdValidator, searchTripValidator }
