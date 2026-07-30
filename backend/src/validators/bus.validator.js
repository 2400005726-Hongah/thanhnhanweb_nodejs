import { body, param, query } from 'express-validator'

const busIdValidator = [param('id').isUUID().withMessage('ID xe không hợp lệ')]
const busSeatParamsValidator = [
  param('busId').isUUID().withMessage('ID xe không hợp lệ'),
  param('seatId').optional().isUUID().withMessage('ID ghế không hợp lệ'),
]

const listBusValidator = [
  query('status').optional().isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
  query('busType').optional().isIn(['SEATED', 'SLEEPER', 'LIMOUSINE']),
  query('keyword').optional().trim().isLength({ max: 100 }).withMessage('Từ khóa không được vượt quá 100 ký tự'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]

const seatObjectValidator = (seats, { req }) => {
  if (!Array.isArray(seats)) {
    throw new Error('Danh sách ghế phải là mảng')
  }

  const codes = seats.map((seat) => String(seat.seatCode || '').trim().toUpperCase())
  if (new Set(codes).size !== codes.length) {
    throw new Error('Mã ghế không được trùng trong cùng xe')
  }
  if (req.body.capacity !== undefined && seats.length > Number(req.body.capacity)) {
    throw new Error('Số ghế không được vượt quá sức chứa')
  }
  return true
}

const busBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)

  return [
    applyOptional(body('busName')).trim().notEmpty().withMessage('Tên xe là bắt buộc').isLength({ max: 100 }),
    applyOptional(body('licensePlate')).trim().notEmpty().withMessage('Biển số xe là bắt buộc'),
    applyOptional(body('busType')).isIn(['SEATED', 'SLEEPER', 'LIMOUSINE']).withMessage('Loại xe không hợp lệ'),
    applyOptional(body('capacity')).isInt({ min: 1 }).withMessage('Sức chứa phải là số nguyên dương'),
    body('status').optional().isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
    body('seats').optional().custom(seatObjectValidator),
  ]
}

const createBusValidator = busBodyRules(false)
const updateBusValidator = [...busIdValidator, ...busBodyRules(true)]

const seatBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)
  return [
    applyOptional(body('seatCode')).trim().notEmpty().withMessage('Mã ghế là bắt buộc'),
    applyOptional(body('floor')).isInt().isIn([1, 2]).withMessage('Tầng ghế chỉ nhận 1 hoặc 2'),
    body('seatType').optional().isIn(['NORMAL', 'VIP']).withMessage('Loại ghế không hợp lệ'),
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
