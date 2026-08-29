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
        if (/^https?:\/\//i.test(value)) return true
        if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) {
          return value.length <= 7_000_000
        }
        return false
      })
      .withMessage('Ảnh đại diện phải là URL HTTP/HTTPS hoặc ảnh JPG, PNG, WEBP không quá 5 MB'),
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

export {
  changeNewsStatusValidator,
  createNewsValidator,
  listNewsValidator,
  newsIdValidator,
  updateNewsValidator,
}
