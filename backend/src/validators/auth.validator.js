import { body } from 'express-validator'

import {
  isValidFullName,
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from '../utils/normalize.js'

const passwordRules = (field, label) =>
  body(field)
    .isString()
    .withMessage(`${label} phải là chuỗi`)
    .isLength({ min: 8, max: 128 })
    .withMessage(`${label} phải có từ 8 đến 128 ký tự`)
    .matches(/[A-Za-z]/)
    .withMessage(`${label} phải có ít nhất một chữ cái`)
    .matches(/[0-9]/)
    .withMessage(`${label} phải có ít nhất một chữ số`)

const registerValidator = [
  body('fullName')
    .customSanitizer(normalizeFullName)
    .notEmpty()
    .withMessage('Họ tên là bắt buộc')
    .custom(isValidFullName)
    .withMessage(
      'Họ tên phải có từ 2 đến 100 ký tự và chỉ gồm chữ, khoảng trắng, dấu chấm, dấu nháy hoặc gạch nối',
    ),
  body('email')
    .customSanitizer(normalizeEmail)
    .notEmpty()
    .withMessage('Email là bắt buộc')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .isLength({ max: 255 })
    .withMessage('Email không được vượt quá 255 ký tự'),
  body('phone')
    .customSanitizer(normalizePhone)
    .notEmpty()
    .withMessage('Số điện thoại là bắt buộc')
    .custom(isVietnamesePhone)
    .withMessage(
      'Số điện thoại Việt Nam phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09',
    ),
  passwordRules('password', 'Mật khẩu'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Xác nhận mật khẩu là bắt buộc')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Xác nhận mật khẩu không khớp'),
  body('role')
    .not()
    .exists()
    .withMessage('Không được tự chỉ định vai trò khi đăng ký'),
]

const loginValidator = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email hoặc số điện thoại là bắt buộc')
    .customSanitizer((value) =>
      String(value || '').includes('@')
        ? normalizeEmail(value)
        : normalizePhone(value),
    )
    .custom((value) =>
      String(value).includes('@')
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        : isVietnamesePhone(value),
    )
    .withMessage('Email hoặc số điện thoại không hợp lệ'),
  body('password').notEmpty().withMessage('Mật khẩu là bắt buộc'),
]

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mật khẩu hiện tại là bắt buộc'),
  passwordRules('newPassword', 'Mật khẩu mới')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('Mật khẩu mới phải khác mật khẩu hiện tại'),
  body('confirmNewPassword')
    .notEmpty()
    .withMessage('Xác nhận mật khẩu mới là bắt buộc')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Xác nhận mật khẩu mới không khớp'),
]

export { changePasswordValidator, loginValidator, registerValidator }
