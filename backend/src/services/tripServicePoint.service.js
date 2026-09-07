import prisma from '../config/prisma.js'
import {
  DROPOFF_SERVICE_MODES,
  LOCATION_TYPES,
  PICKUP_SERVICE_MODES,
  SERVICE_POINT_TYPES,
  normalizePrimaryDropoffMode,
  normalizePrimaryPickupMode,
} from '../config/servicePointCatalog.js'
import HttpError from '../utils/HttpError.js'
import { writeAuditLog } from './auditLog.service.js'

const tripLocationInclude = {
  provinceRef: true,
  defaultArea: true,
}

const servicePointInclude = {
  location: {
    include: {
      provinceRef: true,
      defaultArea: true,
    },
  },
}

const getUsedBookingCount = (point) =>
  Number(point?._count?.pickupBookings || 0) +
  Number(point?._count?.dropoffBookings || 0)

const ensureTripCanConfigureServicePoints = async (database, tripId) => {
  const trip = await database.trip.findUnique({
    where: { id: tripId },
    include: {
      departureLocation: { include: tripLocationInclude },
      arrivalLocation: { include: tripLocationInclude },
    },
  })

  if (!trip) throw new HttpError('Không tìm thấy chuyến xe', 404)
  if (!trip.departureLocationId || !trip.arrivalLocationId) {
    throw new HttpError(
      'Chuyến chưa có điểm đi/đến cụ thể nên chưa thể cấu hình điểm đón/trả',
      409,
    )
  }
  if (trip.departureTime <= new Date()) {
    throw new HttpError(
      'Chuyến đã qua giờ khởi hành nên không thể sửa điểm đón/trả',
      409,
    )
  }
  if (!['OPEN', 'CLOSED'].includes(trip.status)) {
    throw new HttpError('Không thể sửa điểm đón/trả ở trạng thái hiện tại', 409)
  }
  return trip
}

const getTripServicePointsWithDatabase = async (
  database,
  tripId,
  includeInactive = false,
) => {
  const trip = await database.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      departureTime: true,
      expectedArrivalTime: true,
      primaryPickupMode: true,
      primaryDropoffMode: true,
      allowPickupTransfer: true,
      allowPickupMeetingPoint: true,
      allowDropoffTransfer: true,
      allowDropoffStop: true,
      departureLocation: { include: tripLocationInclude },
      arrivalLocation: { include: tripLocationInclude },
    },
  })
  if (!trip) throw new HttpError('Không tìm thấy chuyến xe', 404)

  const servicePoints = await database.tripServicePoint.findMany({
    where: {
      tripId,
      ...(!includeInactive && { status: 'ACTIVE' }),
    },
    include: servicePointInclude,
    orderBy: [
      { pointType: 'asc' },
      { isDefault: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return {
    trip,
    servicePoints,
  }
}

const getTripServicePoints = async (tripId, { includeInactive = false } = {}) =>
  getTripServicePointsWithDatabase(prisma, tripId, includeInactive)

const parseTimeOnly = (value) => {
  if (!value) return null
  const raw = String(value)
  const match = raw.match(/(?:T|^)(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || 0)
  if (hour > 23 || minute > 59 || second > 59) return null
  return new Date(
    `1970-01-01T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`,
  )
}

const toServicePointTime = (date) => {
  if (!date) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {})

  return new Date(`1970-01-01T${parts.hour}:${parts.minute}:${parts.second}Z`)
}

const validateAdditionalPoints = async (database, trip, rawPoints = []) => {
  const uniqueKeys = new Set()
  const locationIds = [
    ...new Set(rawPoints.map((point) => point.locationId).filter(Boolean)),
  ]

  const locations = locationIds.length
    ? await database.location.findMany({
        where: { id: { in: locationIds } },
        select: {
          id: true,
          provinceId: true,
          locationType: true,
          status: true,
        },
      })
    : []

  if (locations.length !== locationIds.length) {
    throw new HttpError('Có địa điểm phục vụ không tồn tại', 400)
  }

  const locationById = new Map(locations.map((location) => [location.id, location]))
  const departureProvinceId = trip.departureLocation?.provinceId
  const arrivalProvinceId = trip.arrivalLocation?.provinceId

  return rawPoints.map((raw, index) => {
    const location = locationById.get(raw.locationId)
    const pointType = raw.pointType
    const key = `${raw.locationId}:${pointType}`

    if (![SERVICE_POINT_TYPES.PICKUP, SERVICE_POINT_TYPES.DROPOFF].includes(pointType)) {
      throw new HttpError(`Loại điểm phục vụ thứ ${index + 1} không hợp lệ`, 400)
    }
    if (!location) {
      throw new HttpError(`Địa điểm phục vụ thứ ${index + 1} không hợp lệ`, 400)
    }
    if (location.status !== 'ACTIVE') {
      throw new HttpError('Địa điểm phục vụ đã ngừng hoạt động', 409)
    }
    if (uniqueKeys.has(key)) {
      throw new HttpError(
        'Một địa điểm không thể lặp lại cùng loại đón/trả trong một chuyến',
        409,
      )
    }
    uniqueKeys.add(key)

    if (pointType === SERVICE_POINT_TYPES.PICKUP) {
      if (![LOCATION_TYPES.PICKUP, LOCATION_TYPES.BOTH].includes(location.locationType)) {
        throw new HttpError(
          'Địa điểm chỉ dùng để trả khách, không thể cấu hình làm điểm hẹn đón',
          400,
        )
      }
      if (departureProvinceId && location.provinceId !== departureProvinceId) {
        throw new HttpError(
          'Điểm hẹn đón phải thuộc cùng Tỉnh/Thành với điểm đi của chuyến',
          400,
        )
      }
      if (raw.locationId === trip.departureLocationId) {
        throw new HttpError(
          'Điểm đi chính đã được hệ thống tự cấu hình, không cần thêm lại',
          409,
        )
      }
      if (raw.serviceMode !== PICKUP_SERVICE_MODES.MEETING_POINT) {
        throw new HttpError('Điểm đón phụ chỉ được cấu hình dưới dạng Điểm hẹn', 400)
      }
    } else {
      if (![LOCATION_TYPES.DROPOFF, LOCATION_TYPES.BOTH].includes(location.locationType)) {
        throw new HttpError(
          'Địa điểm chỉ dùng để đón khách, không thể cấu hình làm điểm dừng trả',
          400,
        )
      }
      if (arrivalProvinceId && location.provinceId !== arrivalProvinceId) {
        throw new HttpError(
          'Điểm dừng trả phải thuộc cùng Tỉnh/Thành với điểm đến của chuyến',
          400,
        )
      }
      if (raw.locationId === trip.arrivalLocationId) {
        throw new HttpError(
          'Điểm đến chính đã được hệ thống tự cấu hình, không cần thêm lại',
          409,
        )
      }
      if (raw.serviceMode !== DROPOFF_SERVICE_MODES.STOP) {
        throw new HttpError('Điểm trả phụ chỉ được cấu hình dưới dạng Điểm dừng', 400)
      }
    }

    const estimatedTime = parseTimeOnly(raw.estimatedTime)
    if (!estimatedTime) {
      throw new HttpError(
        pointType === SERVICE_POINT_TYPES.PICKUP
          ? 'Vui lòng nhập giờ đón dự kiến cho từng điểm hẹn'
          : 'Vui lòng nhập giờ trả dự kiến cho từng điểm dừng',
        400,
      )
    }

    return {
      id: raw.id || null,
      locationId: raw.locationId,
      pointType,
      serviceMode: raw.serviceMode,
      estimatedMinutes: 0,
      estimatedTime,
      isDefault: false,
      sortOrder: Number.isInteger(Number(raw.sortOrder))
        ? Number(raw.sortOrder)
        : index + 2,
      status: 'ACTIVE',
    }
  })
}

const configureTripServicePoints = async (tripId, payload, actor) =>
  prisma.$transaction(async (transaction) => {
    const trip = await ensureTripCanConfigureServicePoints(transaction, tripId)

    const primaryPickupMode = normalizePrimaryPickupMode(payload.primaryPickupMode)
    const primaryDropoffMode = normalizePrimaryDropoffMode(payload.primaryDropoffMode)

    const rawAdditionalPoints = Array.isArray(payload.servicePoints)
      ? payload.servicePoints.filter((point) => {
          if (point.pointType === SERVICE_POINT_TYPES.PICKUP) {
            return payload.allowPickupMeetingPoint === true
          }
          if (point.pointType === SERVICE_POINT_TYPES.DROPOFF) {
            return payload.allowDropoffStop === true
          }
          return false
        })
      : []

    const additionalPoints = await validateAdditionalPoints(
      transaction,
      trip,
      rawAdditionalPoints,
    )

    if (payload.allowPickupMeetingPoint === true && !additionalPoints.some(
      (point) => point.pointType === SERVICE_POINT_TYPES.PICKUP,
    )) {
      throw new HttpError('Đã bật Điểm hẹn nhưng chưa cấu hình điểm hẹn đón khách', 400)
    }
    if (payload.allowDropoffStop === true && !additionalPoints.some(
      (point) => point.pointType === SERVICE_POINT_TYPES.DROPOFF,
    )) {
      throw new HttpError('Đã bật Điểm dừng nhưng chưa cấu hình điểm dừng trả khách', 400)
    }

    const arrivalMinutes = Math.max(
      0,
      Math.round(
        (new Date(trip.expectedArrivalTime).getTime() -
          new Date(trip.departureTime).getTime()) /
          60000,
      ),
    )

    const desiredPoints = [
      {
        id: null,
        locationId: trip.departureLocationId,
        pointType: SERVICE_POINT_TYPES.PICKUP,
        serviceMode: primaryPickupMode,
        estimatedMinutes: 0,
        estimatedTime: toServicePointTime(trip.departureTime),
        isDefault: true,
        sortOrder: 1,
        status: 'ACTIVE',
      },
      {
        id: null,
        locationId: trip.arrivalLocationId,
        pointType: SERVICE_POINT_TYPES.DROPOFF,
        serviceMode: primaryDropoffMode,
        estimatedMinutes: arrivalMinutes,
        estimatedTime: toServicePointTime(trip.expectedArrivalTime),
        isDefault: true,
        sortOrder: 1,
        status: 'ACTIVE',
      },
      ...additionalPoints.map((point, index) => ({
        ...point,
        sortOrder: index + 2,
      })),
    ]

    await transaction.trip.update({
      where: { id: tripId },
      data: {
        primaryPickupMode,
        primaryDropoffMode,
        allowPickupTransfer: payload.allowPickupTransfer === true,
        allowPickupMeetingPoint: payload.allowPickupMeetingPoint === true,
        allowDropoffTransfer: payload.allowDropoffTransfer === true,
        allowDropoffStop: payload.allowDropoffStop === true,
      },
    })

    const existing = await transaction.tripServicePoint.findMany({
      where: { tripId },
      include: {
        _count: {
          select: {
            pickupBookings: true,
            dropoffBookings: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const retainedIds = new Set()

    for (const desired of desiredPoints) {
      let current = desired.id
        ? existing.find((point) => point.id === desired.id)
        : existing.find(
            (point) =>
              point.locationId === desired.locationId &&
              point.pointType === desired.pointType &&
              !retainedIds.has(point.id),
          )

      if (current) {
        const usedCount = getUsedBookingCount(current)
        if (usedCount > 0 && current.serviceMode !== desired.serviceMode) {
          throw new HttpError(
            'Điểm phục vụ đã có khách chọn nên không thể đổi hình thức phục vụ. Hãy ngừng bản ghi cũ và tạo cấu hình mới.',
            409,
          )
        }

        await transaction.tripServicePoint.update({
          where: { id: current.id },
          data: {
            serviceMode: desired.serviceMode,
            estimatedMinutes: desired.estimatedMinutes,
            estimatedTime: desired.estimatedTime,
            isDefault: desired.isDefault,
            sortOrder: desired.sortOrder,
            status: 'ACTIVE',
          },
        })
        retainedIds.add(current.id)
      } else {
        const created = await transaction.tripServicePoint.create({
          data: {
            tripId,
            locationId: desired.locationId,
            pointType: desired.pointType,
            serviceMode: desired.serviceMode,
            estimatedMinutes: desired.estimatedMinutes,
            estimatedTime: desired.estimatedTime,
            isDefault: desired.isDefault,
            sortOrder: desired.sortOrder,
            status: 'ACTIVE',
          },
        })
        retainedIds.add(created.id)
      }
    }

    for (const current of existing) {
      if (retainedIds.has(current.id)) continue
      const usedCount = getUsedBookingCount(current)
      if (usedCount > 0) {
        await transaction.tripServicePoint.update({
          where: { id: current.id },
          data: { status: 'INACTIVE', isDefault: false },
        })
      } else {
        await transaction.tripServicePoint.delete({ where: { id: current.id } })
      }
    }

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'CONFIGURE_TRIP_SERVICE_POINTS',
        entityType: 'TRIP',
        entityId: tripId,
        description: 'Cập nhật 3 lựa chọn điểm đón và 3 lựa chọn điểm trả của chuyến xe',
        metadata: {
          primaryPickupMode,
          primaryDropoffMode,
          pickupTransfer: payload.allowPickupTransfer === true,
          pickupMeetingPoint: payload.allowPickupMeetingPoint === true,
          dropoffTransfer: payload.allowDropoffTransfer === true,
          dropoffStop: payload.allowDropoffStop === true,
          meetingPointCount: additionalPoints.filter(
            (point) => point.pointType === SERVICE_POINT_TYPES.PICKUP,
          ).length,
          stopCount: additionalPoints.filter(
            (point) => point.pointType === SERVICE_POINT_TYPES.DROPOFF,
          ).length,
        },
      },
      transaction,
    )

    return getTripServicePointsWithDatabase(transaction, tripId, true)
  })

export {
  configureTripServicePoints,
  getTripServicePoints,
  getTripServicePointsWithDatabase,
  validateAdditionalPoints,
  PICKUP_SERVICE_MODES,
  DROPOFF_SERVICE_MODES,
}
