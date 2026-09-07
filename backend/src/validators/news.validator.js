import { body, param, query } from 'express-validator'

import { NEWS_STATUSES } from '../services/news.service.js'

const newsIdValidator = [
  param('id').isUUID().withMessage('ID tin tức không hợp lệ'),
]

const listNewsValidator = [
  query('status')
    .optional()
    .isIn(NEWS_STATUSES)
    .withMessage('Trạng thái tin tức không hợp lệ'),
  query('keyword').optional().trim().isLength({ max: 150 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
]

const newsBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)

  return [
    applyOptional(body('title'))
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 250 })
      .withMessage('Tiêu đề tin tức phải có từ 1 đến 250 ký tự'),
    body('slug')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 250 })
      .withMessage('Slug tin tức không hợp lệ'),
    body('summary')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Tóm tắt không được vượt quá 1000 ký tự'),
    applyOptional(body('content'))
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 100000 })
      .withMessage('Nội dung tin tức là bắt buộc'),
    body('thumbnailUrl')
      .optional({ nullable: true })
      .custom((value) => {
        if (!value) return true
        return /^https?:\/\//i.test(value) && String(value).length <= 5000
      })
      .withMessage('Ảnh đại diện phải là URL HTTP/HTTPS hợp lệ'),
    body('status')
      .optional()
      .isIn(NEWS_STATUSES)
      .withMessage('Trạng thái tin tức không hợp lệ'),
  ]
}

const createNewsValidator = newsBodyRules(false)
const updateNewsValidator = [...newsIdValidator, ...newsBodyRules(true)]
const changeNewsStatusValidator = [
  ...newsIdValidator,
  body('status')
    .isIn(NEWS_STATUSES)
    .withMessage('Trạng thái tin tức không hợp lệ'),
]

const deleteNewsImageValidator = [
  body('path')
    .isString()
    .trim()
    .matches(/^news\//)
    .isLength({ min: 6, max: 500 })
    .withMessage('Đường dẫn ảnh tạm không hợp lệ'),
]

export {
  changeNewsStatusValidator,
  createNewsValidator,
  deleteNewsImageValidator,
  listNewsValidator,
  newsIdValidator,
  updateNewsValidator,
}
