import { body } from 'express-validator'

import { routeIdValidator } from './route.validator.js'

const configureRouteStopsValidator = [
  ...routeIdValidator,
  body('stops')
    .isArray({ max: 100 })
    .withMessage('Danh sách khu vực đón/trả không hợp lệ'),
  body('stops.*.areaId')
    .isUUID()
    .withMessage('ID khu vực đón/trả không hợp lệ'),
  body('stops.*.pointType')
    .isIn(['PICKUP', 'DROPOFF'])
    .withMessage('Loại khu vực đón/trả không hợp lệ'),
  body('stops.*.sortOrder')
    .optional()
    .isInt({ min: 0, max: 100000 })
    .toInt(),
  body('stops.*.status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Trạng thái khu vực đón/trả không hợp lệ'),
]

export { configureRouteStopsValidator }
