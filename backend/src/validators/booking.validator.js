import { body, param, query } from 'express-validator'

import { isVietnamesePhone } from '../utils/normalize.js'
import { BOOKING_CODE_PATTERN } from './payment.validator.js'

const MAX_SEATS_PER_BOOKING = 6
const HOLD_TOKEN_PATTERN = /^[a-f0-9]{64}$/i

const tripIdParamValidator = param('tripId')
  .isUUID()
  .withMessage('ID chuyến xe không hợp lệ')

const holdTokenBodyValidator = body('holdToken')
  .isString()
  .withMessage('Mã giữ ghế không hợp lệ')
  .matches(HOLD_TOKEN_PATTERN)
  .withMessage('Mã giữ ghế không hợp lệ')

const holdSeatsValidator = [
  tripIdParamValidator,
  body('tripSeatIds')
    .isArray({ min: 1, max: MAX_SEATS_PER_BOOKING })
    .withMessage(`Bạn phải chọn từ 1 đến ${MAX_SEATS_PER_BOOKING} ghế`)
    .custom((values) => new Set(values).size === values.length)
    .withMessage('Danh sách ghế không được chứa ID trùng nhau'),
  body('tripSeatIds.*').isUUID().withMessage('ID ghế không hợp lệ'),
  body('totalAmount')
    .not()
    .exists()
    .withMessage('Tổng tiền phải do máy chủ tính toán'),
]

const releaseSeatHoldValidator = [tripIdParamValidator, holdTokenBodyValidator]

const createBookingValidator = [
  body('tripId').isUUID().withMessage('ID chuyến xe không hợp lệ'),
  holdTokenBodyValidator,
  body('passenger')
    .isObject({ strict: true })
    .withMessage('Thông tin hành khách không hợp lệ'),
  body('passenger.fullName')
    .isString()
    .withMessage('Họ tên hành khách là bắt buộc')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên hành khách phải có từ 2 đến 100 ký tự'),
  body('passenger.phone')
    .isString()
    .withMessage('Số điện thoại là bắt buộc')
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại Việt Nam không hợp lệ'),
  body('passenger.email')
    .isString()
    .withMessage('Email là bắt buộc khi đặt vé Online')
    .trim()
    .notEmpty()
    .withMessage('Email là bắt buộc khi đặt vé Online')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .isLength({ max: 255 })
    .withMessage('Email không được vượt quá 255 ký tự'),
  body('customerNote')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Ghi chú khách hàng không được vượt quá 500 ký tự'),
  ...[
    'userId',
    'customerId',
    'bookingCode',
    'staffNote',
    'createdById',
    'totalAmount',
    'status',
    'paymentStatus',
    'deletedReason',
    'deletedAt',
    'deletedById',
  ].map(
    (field) =>
      body(field)
        .not()
        .exists()
        .withMessage(`${field} không được gửi từ phía khách hàng`),
  ),
]

const createManagedBookingValidator = [
  body('tripId').isUUID().withMessage('ID chuyến xe không hợp lệ'),
  body('tripSeatIds')
    .isArray({ min: 1, max: MAX_SEATS_PER_BOOKING })
    .withMessage(`Bạn phải chọn từ 1 đến ${MAX_SEATS_PER_BOOKING} ghế`)
    .custom((values) => new Set(values).size === values.length)
    .withMessage('Danh sách ghế không được chứa ID trùng nhau'),
  body('tripSeatIds.*').isUUID().withMessage('ID ghế không hợp lệ'),
  body('source')
    .isIn(['HOTLINE', 'COUNTER'])
    .withMessage('Nguồn đặt vé quản trị phải là HOTLINE hoặc COUNTER'),
  body('passenger')
    .isObject({ strict: true })
    .withMessage('Thông tin hành khách không hợp lệ'),
  body('passenger.fullName')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên hành khách phải có từ 2 đến 100 ký tự'),
  body('passenger.phone')
    .isString()
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại Việt Nam không hợp lệ'),
  body('passenger.email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Email không hợp lệ')
    .isLength({ max: 255 })
    .withMessage('Email không được vượt quá 255 ký tự'),
  body('customerNote')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Ghi chú khách hàng không được vượt quá 500 ký tự'),
  body('staffNote')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Ghi chú nhân viên không được vượt quá 1000 ký tự'),
  ...[
    'holdToken',
    'userId',
    'customerId',
    'bookingCode',
    'createdById',
    'totalAmount',
    'status',
    'paymentStatus',
    'expiresAt',
    'deletedReason',
    'deletedAt',
    'deletedById',
  ].map(
    (field) =>
      body(field)
        .not()
        .exists()
        .withMessage(`${field} không được gửi từ phía quản trị`),
  ),
]

const bookingCodeParamValidator = param('bookingCode')
  .trim()
  .matches(BOOKING_CODE_PATTERN)
  .withMessage('Mã đặt vé không hợp lệ')

const listMyBookingsValidator = [
  query('status')
    .optional()
    .isIn([
      'PENDING',
      'CONFIRMED',
      'CANCELLED',
      'EXPIRED',
      'COMPLETED',
      'NO_SHOW',
    ])
    .withMessage('Trạng thái booking không hợp lệ'),
  query('paymentStatus')
    .optional()
    .isIn(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'])
    .withMessage('Trạng thái thanh toán không hợp lệ'),
  query('sort')
    .optional()
    .isIn([
      'createdAtDesc',
      'createdAtAsc',
      'departureTimeDesc',
      'departureTimeAsc',
    ])
    .withMessage('Kiểu sắp xếp không hợp lệ'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Giới hạn phải từ 1 đến 50')
    .toInt(),
  query('userId')
    .not()
    .exists()
    .withMessage('Không được chỉ định userId'),
]

const cancellationReasonBodyValidator = body('reason')
  .isString()
  .withMessage('Lý do hủy vé là bắt buộc')
  .trim()
  .isLength({ min: 5, max: 500 })
  .withMessage('Lý do hủy vé phải có từ 5 đến 500 ký tự')

const cancelMyBookingValidator = [
  bookingCodeParamValidator,
  cancellationReasonBodyValidator,
]

const cancelGuestBookingValidator = [
  bookingCodeParamValidator,
  body('phone')
    .isString()
    .withMessage('Số điện thoại là bắt buộc')
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại Việt Nam không hợp lệ'),
  cancellationReasonBodyValidator,
]

export {
  HOLD_TOKEN_PATTERN,
  MAX_SEATS_PER_BOOKING,
  cancelGuestBookingValidator,
  cancelMyBookingValidator,
  cancellationReasonBodyValidator,
  createBookingValidator,
  createManagedBookingValidator,
  holdSeatsValidator,
  listMyBookingsValidator,
  releaseSeatHoldValidator,
}
