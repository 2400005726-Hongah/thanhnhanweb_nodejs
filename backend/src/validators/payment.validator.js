import { body, param, query } from 'express-validator'

import {
  isVietnamesePhone,
  normalizeBookingCode,
  normalizePhone,
} from '../utils/normalize.js'

const BOOKING_CODE_PATTERN = /^TN[A-F0-9]{16}$/i

const bookingCodeParamValidator = param('bookingCode')
  .customSanitizer(normalizeBookingCode)
  .matches(BOOKING_CODE_PATTERN)
  .withMessage('Mã đặt vé không hợp lệ')

const phoneBodyValidator = body('phone')
  .isString()
  .withMessage('Số điện thoại là bắt buộc')
  .customSanitizer(normalizePhone)
  .custom(isVietnamesePhone)
  .withMessage('Số điện thoại Việt Nam không hợp lệ')

const simulatePaymentValidator = [
  bookingCodeParamValidator,
  phoneBodyValidator,
  body('paymentMethod')
    .equals('SIMULATED')
    .withMessage('Chức năng này chỉ hỗ trợ thanh toán mô phỏng'),
  ...['amount', 'status', 'transactionCode', 'bookingId'].map((field) =>
    body(field)
      .not()
      .exists()
      .withMessage(`${field} không được gửi từ phía khách hàng`),
  ),
]

const lookupBookingValidator = [
  query('bookingCode')
    .customSanitizer(normalizeBookingCode)
    .matches(BOOKING_CODE_PATTERN)
    .withMessage('Mã đặt vé không hợp lệ'),
  query('phone')
    .isString()
    .withMessage('Số điện thoại là bắt buộc')
    .customSanitizer(normalizePhone)
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại Việt Nam không hợp lệ'),
]

export {
  BOOKING_CODE_PATTERN,
  lookupBookingValidator,
  simulatePaymentValidator,
}
