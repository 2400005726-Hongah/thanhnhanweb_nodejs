import { body, param, query } from 'express-validator'

import {
  isValidFullName,
  isVietnamesePhone,
  normalizeBookingCode,
  normalizeEmail,
  normalizeFullName,
  normalizeMultilineText,
  normalizePhone,
  normalizeWhitespace,
} from '../utils/normalize.js'
import { BOOKING_CODE_PATTERN } from './payment.validator.js'

const paginationRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]

const bookingCodeRule = param('bookingCode')
  .customSanitizer(normalizeBookingCode)
  .matches(BOOKING_CODE_PATTERN)
  .withMessage('Mã đặt vé không hợp lệ')

const listManagedBookingsValidator = [
  query('status')
    .optional()
    .isIn([
      'PENDING',
      'CONFIRMED',
      'CANCELLED',
      'EXPIRED',
      'COMPLETED',
      'NO_SHOW',
      'DELETED',
    ]),
  query('source').optional().isIn(['ONLINE', 'HOTLINE', 'COUNTER']),
  query('paymentStatus')
    .optional()
    .isIn(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']),
  query('trip').optional().isUUID(),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 150 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('departureDate').optional().isISO8601(),
  query('sort').optional().isIn(['asc', 'desc']),
  ...paginationRules,
]

const bookingCodeValidator = [bookingCodeRule]

const reasonRule = (label) =>
  body('reason')
    .isString()
    .withMessage(`${label} là bắt buộc`)
    .customSanitizer(normalizeMultilineText)
    .isLength({ min: 5, max: 500 })
    .withMessage(`${label} phải có từ 5 đến 500 ký tự`)

const cancelManagedBookingValidator = [
  bookingCodeRule,
  reasonRule('Lý do hủy vé'),
]

const deleteManagedBookingValidator = [
  bookingCodeRule,
  reasonRule('Lý do xóa vé'),
]


const collectManagedPaymentValidator = [
  bookingCodeRule,
  body('confirmed')
    .custom((value) => value === true)
    .withMessage('Bạn phải xác nhận đã nhận đủ tiền từ khách'),
]

const undoManagedPaymentValidator = [
  bookingCodeRule,
  reasonRule('Lý do hoàn tác'),
]

const updateBookingContactValidator = [
  bookingCodeRule,
  body('passengerFullName')
    .optional()
    .customSanitizer(normalizeFullName)
    .custom(isValidFullName)
    .withMessage('Họ tên hành khách không hợp lệ'),
  body('passengerPhone')
    .optional()
    .customSanitizer(normalizePhone)
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
  body('staffNote')
    .optional()
    .isString()
    .customSanitizer(normalizeMultilineText)
    .isLength({ max: 500 })
    .withMessage('Ghi chú nhân viên không được vượt quá 500 ký tự'),
  body()
    .custom((value) =>
      [
        'passengerFullName',
        'passengerPhone',
        'staffNote',
      ].some((field) => value[field] !== undefined),
    )
    .withMessage('Cần cung cấp ít nhất một trường cần cập nhật'),
]


const markNoShowValidator = [
  bookingCodeRule,
  reasonRule('Lý do khách không đi'),
]

const listUsersValidator = [
  query('role').optional().isIn(['ADMIN', 'STAFF']),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 150 }),
  ...paginationRules,
]

const listCustomersValidator = [
  query('status').optional().isIn(['ACTIVE', 'BLOCKED', 'ARCHIVED']),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 150 }),
  query('classification').optional().isIn(['VIP', 'REGULAR', 'NEW']),
  query('sortBy').optional().isIn(['newest', 'bookings', 'spending', 'recent', 'name']),
  ...paginationRules,
]

const userIdValidator = [
  param('id').isUUID().withMessage('ID tài khoản không hợp lệ'),
]

const customerIdValidator = [
  param('id').isUUID().withMessage('ID khách hàng không hợp lệ'),
]

const changeCustomerStatusValidator = [
  ...customerIdValidator,
  body('status')
    .isIn(['ACTIVE', 'BLOCKED'])
    .withMessage('Trạng thái khách hàng không hợp lệ'),
  body('reason')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeMultilineText)
    .custom((value, { req }) => {
      if (req.body.status !== 'BLOCKED') return true
      return typeof value === 'string' && value.length >= 5 && value.length <= 500
    })
    .withMessage('Lý do khóa phải có từ 5 đến 500 ký tự'),
]

const createManagedUserValidator = [
  body('fullName')
    .customSanitizer(normalizeFullName)
    .custom(isValidFullName)
    .withMessage('Họ tên không hợp lệ'),
  body('email')
    .customSanitizer(normalizeEmail)
    .isEmail()
    .isLength({ max: 255 }),
  body('phone')
    .customSanitizer(normalizePhone)
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/[A-Za-z]/)
    .matches(/[0-9]/)
    .withMessage('Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số'),
  body('role')
    .isIn(['ADMIN', 'STAFF'])
    .withMessage('Chỉ được tạo tài khoản Chủ xe hoặc Nhân viên'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
]

const updateManagedUserValidator = [
  ...userIdValidator,
  body('fullName')
    .optional()
    .customSanitizer(normalizeFullName)
    .custom(isValidFullName)
    .withMessage('Họ tên không hợp lệ'),
  body('email')
    .optional()
    .customSanitizer(normalizeEmail)
    .isEmail()
    .isLength({ max: 255 }),
  body('phone')
    .optional()
    .customSanitizer(normalizePhone)
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
  body('password')
    .optional({ values: 'falsy' })
    .isLength({ min: 8, max: 128 })
    .matches(/[A-Za-z]/)
    .matches(/[0-9]/)
    .withMessage('Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ và số'),
  body().custom((value) =>
    ['fullName', 'email', 'phone', 'password'].some((field) => value[field] !== undefined),
  ).withMessage('Cần cung cấp ít nhất một trường cần cập nhật'),
]

const changeUserStatusValidator = [
  ...userIdValidator,
  body('status').isIn(['ACTIVE', 'INACTIVE']),
]

const changeUserRoleValidator = [
  ...userIdValidator,
  body('role').isIn(['ADMIN', 'STAFF']),
]

const updateCustomerValidator = [
  ...customerIdValidator,
  body('fullName')
    .optional()
    .customSanitizer(normalizeFullName)
    .custom(isValidFullName)
    .withMessage('Họ tên không hợp lệ'),
  body('email')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeEmail)
    .isEmail()
    .isLength({ max: 255 }),
  body('phone')
    .optional()
    .customSanitizer(normalizePhone)
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
  body('note')
    .optional({ nullable: true })
    .isString()
    .customSanitizer(normalizeMultilineText)
    .isLength({ max: 1000 })
    .withMessage('Ghi chú khách hàng không được vượt quá 1000 ký tự'),
]

const revenueValidator = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('departureDate').optional().isISO8601(),
]

const auditLogValidator = [
  query('role').optional().isIn(['ADMIN', 'STAFF']),
  query('action')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 100 }),
  query('entityType')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 100 }),
  query('keyword')
    .optional()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 150 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  ...paginationRules,
]

export {
  auditLogValidator,
  bookingCodeValidator,
  collectManagedPaymentValidator,
  cancelManagedBookingValidator,
  changeCustomerStatusValidator,
  changeUserRoleValidator,
  changeUserStatusValidator,
  createManagedUserValidator,
  customerIdValidator,
  deleteManagedBookingValidator,
  listCustomersValidator,
  listManagedBookingsValidator,
  listUsersValidator,
  markNoShowValidator,
  revenueValidator,
  undoManagedPaymentValidator,
  updateBookingContactValidator,
  updateCustomerValidator,
  updateManagedUserValidator,
  userIdValidator,
}
