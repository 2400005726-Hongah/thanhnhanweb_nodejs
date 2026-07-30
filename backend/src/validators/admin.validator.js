import { body, param, query } from 'express-validator'

import { isVietnamesePhone } from '../utils/normalize.js'
import { BOOKING_CODE_PATTERN } from './payment.validator.js'

const paginationRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]

const bookingCodeRule = param('bookingCode')
  .trim()
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
    ]),
  query('paymentStatus')
    .optional()
    .isIn(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']),
  query('trip').optional().isUUID(),
  query('keyword').optional().trim().isLength({ max: 150 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('sort').optional().isIn(['asc', 'desc']),
  ...paginationRules,
]

const bookingCodeValidator = [bookingCodeRule]

const updateBookingContactValidator = [
  bookingCodeRule,
  body('passengerFullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }),
  body('passengerPhone')
    .optional()
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
  body('passengerEmail')
    .optional({ values: 'falsy' })
    .isEmail()
    .isLength({ max: 255 }),
  body()
    .custom((value) =>
      ['passengerFullName', 'passengerPhone', 'passengerEmail'].some(
        (field) => value[field] !== undefined,
      ),
    )
    .withMessage('Cần cung cấp ít nhất một trường cần cập nhật'),
]

const markNoShowValidator = [
  bookingCodeRule,
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Lý do Không đi phải có từ 5 đến 500 ký tự'),
]

const listUsersValidator = [
  query('role').optional().isIn(['CUSTOMER', 'ADMIN', 'STAFF']),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  query('keyword').optional().trim().isLength({ max: 150 }),
  ...paginationRules,
]

const userIdValidator = [
  param('id').isUUID().withMessage('ID tài khoản không hợp lệ'),
]

const createManagedUserValidator = [
  body('fullName').trim().isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().isLength({ max: 255 }),
  body('phone')
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/[A-Za-z]/)
    .matches(/[0-9]/)
    .withMessage('Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số'),
  body('role')
    .isIn(['ADMIN', 'STAFF'])
    .withMessage('Chỉ được tạo tài khoản ADMIN hoặc STAFF'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
]

const changeUserStatusValidator = [
  ...userIdValidator,
  body('status').isIn(['ACTIVE', 'INACTIVE']),
]

const changeUserRoleValidator = [
  ...userIdValidator,
  body('role').isIn(['CUSTOMER', 'ADMIN', 'STAFF']),
]

const updateCustomerValidator = [
  ...userIdValidator,
  body('fullName').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().isLength({ max: 255 }),
  body('phone')
    .optional()
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại không hợp lệ'),
]

const revenueValidator = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
]

const auditLogValidator = [
  query('role').optional().isIn(['ADMIN', 'STAFF']),
  query('action').optional().trim().isLength({ max: 100 }),
  query('entityType').optional().trim().isLength({ max: 100 }),
  ...paginationRules,
]

export {
  auditLogValidator,
  bookingCodeValidator,
  changeUserRoleValidator,
  changeUserStatusValidator,
  createManagedUserValidator,
  listManagedBookingsValidator,
  listUsersValidator,
  markNoShowValidator,
  revenueValidator,
  updateBookingContactValidator,
  updateCustomerValidator,
  userIdValidator,
}
