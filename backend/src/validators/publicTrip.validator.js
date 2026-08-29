import { param, query } from 'express-validator'

import { SUPPORTED_BUS_TYPES } from '../config/busCatalog.js'
import { isValidDateOnly, isValidTimeOnly } from '../utils/dateTime.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeIdList = (value) => {
  if (!value) return []
  const values = Array.isArray(value) ? value : String(value).split(',')
  return values.map((item) => String(item).trim()).filter(Boolean)
}

const isValidUuidList = (value) => normalizeIdList(value).every((item) => UUID_PATTERN.test(item))

const publicLocationValidator = [
  query('keyword').optional().trim().isLength({ max: 100 }).withMessage('Từ khóa không được vượt quá 100 ký tự'),
]

const searchTripValidator = [
  query('departureLocationId')
    .optional()
    .isUUID()
    .withMessage('Điểm đi không hợp lệ'),
  query('arrivalLocationId')
    .optional()
    .isUUID()
    .withMessage('Điểm đến không hợp lệ'),
  query('departureProvinceId')
    .optional()
    .isUUID()
    .withMessage('Tỉnh/Thành đi không hợp lệ'),
  query('arrivalProvinceId')
    .optional()
    .isUUID()
    .withMessage('Tỉnh/Thành đến không hợp lệ'),
  query('departureAreaIds')
    .optional()
    .custom(isValidUuidList)
    .withMessage('Bộ lọc điểm đi không hợp lệ'),
  query('arrivalAreaIds')
    .optional()
    .custom(isValidUuidList)
    .withMessage('Bộ lọc điểm đến không hợp lệ'),
  query('departureDate')
    .notEmpty().withMessage('Ngày đi là bắt buộc')
    .custom(isValidDateOnly).withMessage('Ngày đi không hợp lệ')
    .custom((value, { req }) => {
      const hasProvinceSearch = Boolean(
        req.query.departureProvinceId && req.query.arrivalProvinceId,
      )
      const hasLocationSearch = Boolean(
        req.query.departureLocationId && req.query.arrivalLocationId,
      )

      if (!hasProvinceSearch && !hasLocationSearch) {
        throw new Error('Vui lòng chọn đầy đủ Tỉnh/Thành đi và Tỉnh/Thành đến')
      }
      if (
        req.query.departureProvinceId &&
        req.query.arrivalProvinceId &&
        req.query.departureProvinceId === req.query.arrivalProvinceId
      ) {
        throw new Error('Tỉnh/Thành đi phải khác Tỉnh/Thành đến')
      }
      if (
        req.query.departureLocationId &&
        req.query.arrivalLocationId &&
        req.query.departureLocationId === req.query.arrivalLocationId
      ) {
        throw new Error('Điểm đi phải khác điểm đến')
      }
      if (
        (req.query.departureAreaIds || req.query.arrivalAreaIds) &&
        !hasProvinceSearch
      ) {
        throw new Error('Bộ lọc khu vực chỉ dùng khi tìm theo Tỉnh/Thành')
      }
      return true
    }),
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
  query('busType')
    .optional()
    .isIn(SUPPORTED_BUS_TYPES)
    .withMessage('Loại xe không hợp lệ'),
  query('sort').optional().isIn(['departureTimeAsc', 'departureTimeDesc', 'priceAsc', 'priceDesc']).withMessage('Kiểu sắp xếp không hợp lệ'),
  query('page').optional().isInt({ min: 1 }).withMessage('Trang phải từ 1 trở lên').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Giới hạn phải từ 1 đến 50').toInt(),
]

const publicTripIdValidator = [
  param('tripId').isUUID().withMessage('ID chuyến xe không hợp lệ'),
]

export { publicLocationValidator, publicTripIdValidator, searchTripValidator }
