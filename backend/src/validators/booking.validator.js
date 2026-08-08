import { body, param, query } from 'express-validator'

import {
  SOURCE_PAYMENT_METHODS,
  isPaymentMethodAllowed,
} from '../config/paymentMethods.js'
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

const roomSelectionsRules = [
  body('roomSelections')
    .optional()
    .isArray({ max: MAX_SEATS_PER_BOOKING })
    .withMessage(`Danh sách loại phòng không được vượt quá ${MAX_SEATS_PER_BOOKING} vị trí`)
    .custom((values) => {
      const ids = values.map((item) => item?.tripSeatId)
      return new Set(ids).size === ids.length
    })
    .withMessage('Mỗi phòng chỉ được chọn một loại vé'),
  body('roomSelections.*.tripSeatId')
    .isUUID()
    .withMessage('ID phòng không hợp lệ'),
  body('roomSelections.*.roomType')
    .isIn(['SINGLE_ROOM', 'DOUBLE_ROOM'])
    .withMessage('Loại phòng phải là Phòng đơn hoặc Phòng đôi'),
]

const holdSeatsValidator = [
  tripIdParamValidator,
  body('tripSeatIds')
    .isArray({ min: 1, max: MAX_SEATS_PER_BOOKING })
    .withMessage(`Bạn phải chọn từ 1 đến ${MAX_SEATS_PER_BOOKING} ghế`)
    .custom((values) => new Set(values).size === values.length)
    .withMessage('Danh sách ghế không được chứa ID trùng nhau'),
  body('tripSeatIds.*').isUUID().withMessage('ID ghế không hợp lệ'),
  ...roomSelectionsRules,
  body('totalAmount')
    .not()
    .exists()
    .withMessage('Tổng tiền phải do máy chủ tính toán'),
]

const releaseSeatHoldValidator = [tripIdParamValidator, holdTokenBodyValidator]

const passengerRules = ({ emailRequired }) => [
  body('passenger')
    .isObject({ strict: true })
    .withMessage('Thông tin hành khách không hợp lệ'),
  body('passenger.fullName')
    .isString()
    .withMessage('Họ tên hành khách là bắt buộc')
    .customSanitizer(normalizeFullName)
    .custom(isValidFullName)
    .withMessage('Họ tên hành khách không hợp lệ'),
  body('passenger.phone')
    .isString()
    .withMessage('Số điện thoại là bắt buộc')
    .customSanitizer(normalizePhone)
    .custom(isVietnamesePhone)
    .withMessage(
      'Số điện thoại Việt Nam phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09',
    ),
  emailRequired
    ? body('passenger.email')
        .isString()
        .withMessage('Email là bắt buộc khi đặt vé trực tuyến')
        .customSanitizer(normalizeEmail)
        .notEmpty()
        .withMessage('Email là bắt buộc khi đặt vé trực tuyến')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .isLength({ max: 255 })
        .withMessage('Email không được vượt quá 255 ký tự')
    : body('passenger.email')
        .optional({ values: 'falsy' })
        .customSanitizer(normalizeEmail)
        .isEmail()
        .withMessage('Email không hợp lệ')
        .isLength({ max: 255 })
        .withMessage('Email không được vượt quá 255 ký tự'),
]

const bookingTextRules = [
  body('pickupPoint')
    .optional({ values: 'falsy' })
    .isString()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 300 })
    .withMessage('Điểm đón chi tiết không được vượt quá 300 ký tự'),
  body('dropoffPoint')
    .optional({ values: 'falsy' })
    .isString()
    .customSanitizer(normalizeWhitespace)
    .isLength({ max: 300 })
    .withMessage('Điểm trả chi tiết không được vượt quá 300 ký tự'),
  body('customerNote')
    .optional({ values: 'falsy' })
    .isString()
    .customSanitizer(normalizeMultilineText)
    .isLength({ max: 500 })
    .withMessage('Ghi chú khách hàng không được vượt quá 500 ký tự'),
]

const createBookingValidator = [
  body('tripId').isUUID().withMessage('ID chuyến xe không hợp lệ'),
  holdTokenBodyValidator,
  ...roomSelectionsRules,
  ...passengerRules({ emailRequired: true }),
  ...bookingTextRules,
  body('paymentMethod')
    .isIn(SOURCE_PAYMENT_METHODS.ONLINE)
    .withMessage('Phương thức thanh toán trực tuyến không hợp lệ'),
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
  ].map((field) =>
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
  ...roomSelectionsRules,
  body('source')
    .isIn(['HOTLINE', 'COUNTER'])
    .withMessage('Nguồn đặt vé quản trị phải là Hotline hoặc Tại quầy'),
  ...passengerRules({ emailRequired: false }),
  ...bookingTextRules,
  body('staffNote')
    .optional({ values: 'falsy' })
    .isString()
    .customSanitizer(normalizeMultilineText)
    .isLength({ max: 1000 })
    .withMessage('Ghi chú nhân viên không được vượt quá 1000 ký tự'),
  body('paymentMethod')
    .custom((paymentMethod, { req }) =>
      isPaymentMethodAllowed(req.body.source, paymentMethod),
    )
    .withMessage('Phương thức thanh toán không hợp lệ với nguồn đặt vé'),
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
  ].map((field) =>
    body(field)
      .not()
      .exists()
      .withMessage(`${field} không được gửi từ phía quản trị`),
  ),
]

const bookingCodeParamValidator = param('bookingCode')
  .customSanitizer(normalizeBookingCode)
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
    .withMessage('Trạng thái vé không hợp lệ'),
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
  query('userId').not().exists().withMessage('Không được chỉ định userId'),
]

const cancellationReasonBodyValidator = body('reason')
  .isString()
  .withMessage('Lý do hủy vé là bắt buộc')
  .customSanitizer(normalizeMultilineText)
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
    .customSanitizer(normalizePhone)
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
