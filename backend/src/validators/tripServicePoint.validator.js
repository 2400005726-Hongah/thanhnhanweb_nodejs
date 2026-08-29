import { body } from 'express-validator'

import { tripIdValidator } from './trip.validator.js'

const configureTripServicePointsValidator = [
  ...tripIdValidator,
  body('primaryPickupMode')
    .isIn(['TaiVanPhong', 'DonTaiBenXe'])
    .withMessage('Hình thức tại điểm đón chính không hợp lệ'),
  body('primaryDropoffMode')
    .isIn(['TraTaiBenXe', 'TraTaiVanPhong'])
    .withMessage('Hình thức tại điểm trả chính không hợp lệ'),
  body('allowPickupTransfer').isBoolean().toBoolean(),
  body('allowPickupMeetingPoint').isBoolean().toBoolean(),
  body('allowDropoffTransfer').isBoolean().toBoolean(),
  body('allowDropoffStop').isBoolean().toBoolean(),
  body('servicePoints')
    .isArray({ min: 0, max: 100 })
    .withMessage('Danh sách điểm hẹn/điểm dừng không hợp lệ'),
  body('servicePoints.*.id')
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage('ID điểm phục vụ không hợp lệ'),
  body('servicePoints.*.locationId')
    .isUUID()
    .withMessage('ID địa điểm phục vụ không hợp lệ'),
  body('servicePoints.*.pointType')
    .isIn(['PICKUP', 'DROPOFF'])
    .withMessage('Loại điểm phục vụ không hợp lệ'),
  body('servicePoints.*.serviceMode')
    .custom((value, { req, path }) => {
      const match = path.match(/servicePoints\[(\d+)\]/)
      const index = match ? Number(match[1]) : -1
      const point = req.body.servicePoints?.[index]
      if (!point) return true
      if (point.pointType === 'PICKUP' && value !== 'DonTaiDiemHen') {
        throw new Error('Điểm đón phụ chỉ được dùng làm điểm hẹn')
      }
      if (point.pointType === 'DROPOFF' && value !== 'TraTaiDiemDung') {
        throw new Error('Điểm trả phụ chỉ được dùng làm điểm dừng')
      }
      return true
    }),
  body('servicePoints.*.estimatedTime')
    .matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
    .withMessage('Giờ dự kiến phải có định dạng HH:mm'),
  body('servicePoints.*.sortOrder')
    .optional()
    .isInt({ min: 0, max: 100000 })
    .toInt(),
  body('servicePoints.*.status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE']),
]

export { configureTripServicePointsValidator }
