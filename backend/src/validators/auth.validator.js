import { body } from 'express-validator'

import {
  isVietnamesePhone,
  normalizeEmail,
  normalizePhone,
} from '../utils/normalize.js'

const passwordRules = (field, label) =>
  body(field)
    .isString()
    .withMessage(`${label} phải là chuỗi`)
    .isLength({ min: 8 })
    .withMessage(`${label} phải có ít nhất 8 ký tự`)
    .matches(/[A-Za-z]/)
    .withMessage(`${label} phải có ít nhất một chữ cái`)
    .matches(/[0-9]/)
    .withMessage(`${label} phải có ít nhất một chữ số`)

const registerValidator = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Họ tên là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải có từ 2 đến 100 ký tự'),
  body('email')
    .customSanitizer(normalizeEmail)
    .notEmpty()
    .withMessage('Email là bắt buộc')
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('phone')
    .customSanitizer(normalizePhone)
    .notEmpty()
    .withMessage('Số điện thoại là bắt buộc')
    .custom(isVietnamesePhone)
    .withMessage('Số điện thoại Việt Nam không hợp lệ'),
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
      value.includes('@') ? normalizeEmail(value) : normalizePhone(value),
    ),
  body('password').notEmpty().withMessage('Mật khẩu là bắt buộc'),
]

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mật khẩu hiện tại là bắt buộc'),
  passwordRules('newPassword', 'Mật khẩu mới').custom(
    (value, { req }) => value !== req.body.currentPassword,
  ).withMessage('Mật khẩu mới phải khác mật khẩu hiện tại'),
  body('confirmNewPassword')
    .notEmpty()
    .withMessage('Xác nhận mật khẩu mới là bắt buộc')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Xác nhận mật khẩu mới không khớp'),
]

export { changePasswordValidator, loginValidator, registerValidator }

