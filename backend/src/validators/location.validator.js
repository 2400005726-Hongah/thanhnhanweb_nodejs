import { body, param, query } from 'express-validator'

const locationIdValidator = [param('id').isUUID().withMessage('ID địa điểm không hợp lệ')]

const listLocationValidator = [
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ'),
  query('keyword').optional().trim().isLength({ max: 100 }).withMessage('Từ khóa không được vượt quá 100 ký tự'),
  query('page').optional().isInt({ min: 1 }).withMessage('page phải từ 1 trở lên'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit phải từ 1 đến 100'),
]

const createLocationValidator = [
  body('name').trim().notEmpty().withMessage('Tên địa điểm là bắt buộc').isLength({ max: 150 }),
  body('province').trim().notEmpty().withMessage('Tỉnh/thành phố là bắt buộc').isLength({ max: 100 }),
  body('address').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ'),
]

const updateLocationValidator = [
  ...locationIdValidator,
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('province').optional().trim().notEmpty().isLength({ max: 100 }),
  body('address').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ'),
]

export { createLocationValidator, listLocationValidator, locationIdValidator, updateLocationValidator }
