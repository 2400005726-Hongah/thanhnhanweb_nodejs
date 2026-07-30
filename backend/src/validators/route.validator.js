import { body, param, query } from 'express-validator'

const routeIdValidator = [param('id').isUUID().withMessage('ID tuyến xe không hợp lệ')]

const listRouteValidator = [
  query('departureLocation').optional().isUUID().withMessage('Điểm đi không hợp lệ'),
  query('arrivalLocation').optional().isUUID().withMessage('Điểm đến không hợp lệ'),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ'),
  query('keyword').optional().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]

const routeBodyRules = (optional = false) => {
  const applyOptional = (chain) => (optional ? chain.optional() : chain)

  return [
    applyOptional(body('routeName')).trim().notEmpty().withMessage('Tên tuyến là bắt buộc').isLength({ max: 200 }),
    applyOptional(body('departureLocation')).isUUID().withMessage('Điểm đi không hợp lệ'),
    applyOptional(body('arrivalLocation')).isUUID().withMessage('Điểm đến không hợp lệ'),
    applyOptional(body('distanceKm')).isFloat({ gt: 0 }).withMessage('Khoảng cách phải lớn hơn 0'),
    applyOptional(body('estimatedDurationMinutes')).isInt({ min: 1 }).withMessage('Thời gian dự kiến phải lớn hơn 0'),
    body('defaultTicketPrice')
      .optional({ nullable: true })
      .isFloat({ min: 0 })
      .withMessage('Giá vé mặc định không hợp lệ'),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Trạng thái không hợp lệ'),
  ]
}

const createRouteValidator = routeBodyRules(false)
const updateRouteValidator = [...routeIdValidator, ...routeBodyRules(true)]

export { createRouteValidator, listRouteValidator, routeIdValidator, updateRouteValidator }
