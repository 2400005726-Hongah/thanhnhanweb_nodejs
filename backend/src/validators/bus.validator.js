import { body, param, query } from 'express-validator'

import {
  getBusCapacity,
  MANAGED_BUS_TYPES,
  SUPPORTED_BUS_TYPES,
} from '../config/busCatalog.js'

const busIdValidator = [param('id').isUUID().withMessage('ID xe không hợp lệ')]
const busSeatParamsValidator = [
  param('busId').isUUID().withMessage('ID xe không hợp lệ'),
  param('seatId').optional().isUUID().withMessage('ID ghế không hợp lệ'),
]

const listBusValidator = [
  query('status').optional().isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
  query('busType').optional().isIn(SUPPORTED_BUS_TYPES),
  query('keyword').optional().trim().isLength({ max: 100 }).withMessage('Từ khóa không được vượt quá 100 ký tự'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]

const createBusValidator = [
  body('busName')
    .trim()
    .notEmpty()
    .withMessage('Tên xe là bắt buộc')
    .isLength({ max: 100 }),
  body('licensePlate')
    .trim()
    .notEmpty()
    .withMessage('Biển số xe là bắt buộc'),
  body('busType')
    .isIn(Object.values(MANAGED_BUS_TYPES))
    .withMessage('Xe mới chỉ hỗ trợ SLEEPER_34 hoặc LIMOUSINE_22'),
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
  body('status').optional().isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
]

const updateBusValidator = [
  ...busIdValidator,
  body('busName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tên xe không được để trống')
    .isLength({ max: 100 }),
  body('licensePlate').optional().trim().notEmpty(),
  body('busType')
    .optional()
    .isIn(SUPPORTED_BUS_TYPES)
    .withMessage('Loại xe không hợp lệ'),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sức chứa phải là số nguyên dương'),
  body('status').optional().isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
  body('seats')
    .not()
    .exists()
    .withMessage('Không cập nhật sơ đồ ghế qua API sửa xe'),
]

const seatBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)
  return [
    applyOptional(body('seatCode')).trim().notEmpty().withMessage('Mã ghế là bắt buộc'),
    applyOptional(body('floor')).isInt().isIn([1, 2]).withMessage('Tầng ghế chỉ nhận 1 hoặc 2'),
    body('seatType')
      .optional()
      .isIn(['NORMAL', 'VIP', 'SINGLE_ROOM', 'DOUBLE_ROOM'])
      .withMessage('Loại ghế không hợp lệ'),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái ghế không hợp lệ'),
  ]
}

const addSeatValidator = [param('busId').isUUID().withMessage('ID xe không hợp lệ'), ...seatBodyRules(false)]
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
