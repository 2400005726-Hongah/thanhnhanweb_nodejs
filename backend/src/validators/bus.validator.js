import { body, param, query } from 'express-validator'

import {
  getBusCapacity,
  MANAGED_BUS_TYPES,
  SUPPORTED_BUS_TYPES,
} from '../config/busCatalog.js'
import {
  isVietnameseLicensePlate,
  normalizeLicensePlate,
  normalizeWhitespace,
} from '../utils/normalize.js'

const validateLicensePlate = (value) => {
  if (!isVietnameseLicensePlate(value)) {
    throw new Error('Biển số xe phải đúng định dạng XXY-XXX.XX, ví dụ 47B-123.45')
  }
  return true
}

const busIdValidator = [
  param('id').isUUID().withMessage('Mã xe không hợp lệ'),
]

const busSeatParamsValidator = [
  param('busId').isUUID().withMessage('Mã xe không hợp lệ'),
  param('seatId').optional().isUUID().withMessage('Mã ghế không hợp lệ'),
]

const listBusValidator = [
  query('status')
    .optional()
    .isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])
    .withMessage('Trạng thái xe không hợp lệ'),
  query('busType')
    .optional()
    .isIn(SUPPORTED_BUS_TYPES)
    .withMessage('Loại xe không hợp lệ'),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 100 })
    .withMessage('Từ khóa không được vượt quá 100 ký tự'),
  query('page').optional().isInt({ min: 1 }).withMessage('Số trang không hợp lệ'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số xe mỗi trang phải từ 1 đến 100'),
]

const createBusValidator = [
  body('busName')
    .customSanitizer(normalizeWhitespace)
    .notEmpty()
    .withMessage('Tên xe là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên xe phải có từ 2 đến 100 ký tự'),
  body('licensePlate')
    .customSanitizer(normalizeLicensePlate)
    .notEmpty()
    .withMessage('Biển số xe là bắt buộc')
    .custom(validateLicensePlate),
  body('busType')
    .isIn(Object.values(MANAGED_BUS_TYPES))
    .withMessage('Xe mới chỉ hỗ trợ xe 34 giường hoặc xe 22 phòng'),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sức chứa phải là số nguyên dương')
    .bail()
    .custom((value, { req }) => Number(value) === getBusCapacity(req.body.busType))
    .withMessage('Sức chứa không khớp với loại xe'),
  body('seats')
    .optional()
    .custom((seats) => Array.isArray(seats) && seats.length === 0)
    .withMessage('Sơ đồ ghế phải do máy chủ tạo tự động'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])
    .withMessage('Trạng thái xe không hợp lệ'),
]

const updateBusValidator = [
  ...busIdValidator,
  body('busName')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .notEmpty()
    .withMessage('Tên xe không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên xe phải có từ 2 đến 100 ký tự'),
  body('licensePlate')
    .optional()
    .customSanitizer(normalizeLicensePlate)
    .notEmpty()
    .withMessage('Biển số xe không được để trống')
    .custom(validateLicensePlate),
  body('busType')
    .optional()
    .isIn(SUPPORTED_BUS_TYPES)
    .withMessage('Loại xe không hợp lệ'),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sức chứa phải là số nguyên dương'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])
    .withMessage('Trạng thái xe không hợp lệ'),
  body('seats')
    .not()
    .exists()
    .withMessage('Không cập nhật sơ đồ ghế qua chức năng sửa xe'),
]

const seatBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)
  return [
    applyOptional(body('seatCode'))
      .customSanitizer((value) => String(value || '').trim().toUpperCase())
      .notEmpty()
      .withMessage('Mã ghế là bắt buộc'),
    applyOptional(body('floor'))
      .isInt()
      .isIn([1, 2])
      .withMessage('Tầng ghế chỉ nhận tầng 1 hoặc tầng 2'),
    body('seatType')
      .optional()
      .isIn(['NORMAL', 'VIP', 'SINGLE_ROOM', 'DOUBLE_ROOM'])
      .withMessage('Loại ghế không hợp lệ'),
    body('status')
      .optional()
      .isIn(['ACTIVE', 'INACTIVE'])
      .withMessage('Trạng thái ghế không hợp lệ'),
  ]
}

const addSeatValidator = [
  param('busId').isUUID().withMessage('Mã xe không hợp lệ'),
  ...seatBodyRules(false),
]
const updateSeatValidator = [...busSeatParamsValidator, ...seatBodyRules(true)]

export {
  addSeatValidator,
  busIdValidator,
  busSeatParamsValidator,
  createBusValidator,
  listBusValidator,
  updateBusValidator,
  updateSeatValidator,
}
