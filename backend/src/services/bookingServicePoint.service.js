import {
  DROPOFF_KINDS,
  DROPOFF_SERVICE_MODES,
  PICKUP_KINDS,
  PICKUP_SERVICE_MODES,
  SERVICE_POINT_TYPES,
} from '../config/servicePointCatalog.js'
import HttpError from '../utils/HttpError.js'
import { normalizeWhitespace } from '../utils/normalize.js'

const formatLocationSnapshot = (location) => {
  if (!location) return null
  const parts = [location.name, location.address].map(normalizeWhitespace).filter(Boolean)
  return parts.join(' - ') || null
}

const normalizeRequestedAddress = (value, label) => {
  const normalized = normalizeWhitespace(value)
  if (normalized.length < 5) {
    throw new HttpError(`Vui lòng nhập địa chỉ ${label} cụ thể cho xe trung chuyển`, 400)
  }
  if (normalized.length > 500) {
    throw new HttpError(`Địa chỉ ${label} không được vượt quá 500 ký tự`, 400)
  }
  return normalized
}

const getActiveServicePoints = (trip, pointType) =>
  (trip.servicePoints || []).filter(
    (point) =>
      point.pointType === pointType &&
      point.status === 'ACTIVE' &&
      point.location?.status !== 'INACTIVE',
  )

const getPrimaryLocation = (trip, pointType) => {
  if (pointType === SERVICE_POINT_TYPES.PICKUP) {
    return trip.departureLocation || trip.route?.departureLocation || null
  }
  return trip.arrivalLocation || trip.route?.arrivalLocation || null
}

const getPrimaryServiceMode = (trip, pointType) =>
  pointType === SERVICE_POINT_TYPES.PICKUP
    ? trip.primaryPickupMode || PICKUP_SERVICE_MODES.BUS_STATION
    : trip.primaryDropoffMode || DROPOFF_SERVICE_MODES.BUS_STATION

const resolvePrimary = (trip, pointType, legacyText) => {
  const points = getActiveServicePoints(trip, pointType)
  const primaryLocation = getPrimaryLocation(trip, pointType)
  const configured = points.find(
    (point) => point.isDefault && point.location?.id === primaryLocation?.id,
  )
  const location = configured?.location || primaryLocation

  if (!location) {
    throw new HttpError(
      pointType === SERVICE_POINT_TYPES.PICKUP
        ? 'Chuyến chưa có điểm đón chính hợp lệ'
        : 'Chuyến chưa có điểm trả chính hợp lệ',
      409,
    )
  }

  const fallbackText = formatLocationSnapshot(location)
  const pointText = normalizeWhitespace(legacyText) || fallbackText

  return {
    locationId: location.id,
    servicePointId: configured?.id || null,
    serviceMode: configured?.serviceMode || getPrimaryServiceMode(trip, pointType),
    kind:
      pointType === SERVICE_POINT_TYPES.PICKUP
        ? PICKUP_KINDS.PRIMARY
        : DROPOFF_KINDS.PRIMARY,
    requestedAddress: null,
    pointText,
  }
}

const resolveConfiguredPoint = ({
  trip,
  pointType,
  servicePointId,
  expectedMode,
  kind,
  invalidMessage,
}) => {
  if (!servicePointId) throw new HttpError(invalidMessage, 400)

  const primaryLocation = getPrimaryLocation(trip, pointType)
  const point = getActiveServicePoints(trip, pointType).find(
    (item) =>
      item.id === servicePointId &&
      item.serviceMode === expectedMode &&
      item.isDefault !== true &&
      (!primaryLocation?.provinceId ||
        !item.location?.provinceId ||
        item.location.provinceId === primaryLocation.provinceId),
  )

  if (!point || !point.location) {
    throw new HttpError(invalidMessage, 400)
  }


  return {
    locationId: point.location.id,
    servicePointId: point.id,
    serviceMode: point.serviceMode,
    kind,
    requestedAddress: null,
    pointText: formatLocationSnapshot(point.location),
  }
}

const resolvePickup = (trip, payload) => {
  const kind = payload.pickupKind || PICKUP_KINDS.PRIMARY

  if (kind === PICKUP_KINDS.PRIMARY) {
    return resolvePrimary(trip, SERVICE_POINT_TYPES.PICKUP, payload.pickupPoint)
  }

  if (kind === PICKUP_KINDS.TRANSFER) {
    if (!trip.allowPickupTransfer) {
      throw new HttpError('Chuyến này không hỗ trợ xe trung chuyển đón khách', 400)
    }
    const requestedAddress = normalizeRequestedAddress(
      payload.pickupRequestedAddress,
      'đón',
    )
    return {
      locationId: null,
      servicePointId: null,
      serviceMode: PICKUP_SERVICE_MODES.TRANSFER,
      kind,
      requestedAddress,
      pointText: requestedAddress,
    }
  }

  if (kind === PICKUP_KINDS.MEETING_POINT) {
    if (!trip.allowPickupMeetingPoint) {
      throw new HttpError('Chuyến này không hỗ trợ đón khách tại điểm hẹn', 400)
    }
    return resolveConfiguredPoint({
      trip,
      pointType: SERVICE_POINT_TYPES.PICKUP,
      servicePointId: payload.pickupServicePointId,
      expectedMode: PICKUP_SERVICE_MODES.MEETING_POINT,
      kind,
      invalidMessage: 'Điểm hẹn đón khách không hợp lệ hoặc đã ngừng hoạt động',
    })
  }

  throw new HttpError('Phương án đón khách không hợp lệ', 400)
}

const resolveDropoff = (trip, payload) => {
  const kind = payload.dropoffKind || DROPOFF_KINDS.PRIMARY

  if (kind === DROPOFF_KINDS.PRIMARY) {
    return resolvePrimary(trip, SERVICE_POINT_TYPES.DROPOFF, payload.dropoffPoint)
  }

  if (kind === DROPOFF_KINDS.TRANSFER) {
    if (!trip.allowDropoffTransfer) {
      throw new HttpError('Chuyến này không hỗ trợ xe trung chuyển trả tận nơi', 400)
    }
    const requestedAddress = normalizeRequestedAddress(
      payload.dropoffRequestedAddress,
      'trả',
    )
    return {
      locationId: null,
      servicePointId: null,
      serviceMode: DROPOFF_SERVICE_MODES.TRANSFER,
      kind,
      requestedAddress,
      pointText: requestedAddress,
    }
  }

  if (kind === DROPOFF_KINDS.STOP) {
    if (!trip.allowDropoffStop) {
      throw new HttpError('Chuyến này không hỗ trợ trả khách tại điểm dừng', 400)
    }
    return resolveConfiguredPoint({
      trip,
      pointType: SERVICE_POINT_TYPES.DROPOFF,
      servicePointId: payload.dropoffServicePointId,
      expectedMode: DROPOFF_SERVICE_MODES.STOP,
      kind,
      invalidMessage: 'Điểm dừng trả khách không hợp lệ hoặc đã ngừng hoạt động',
    })
  }

  throw new HttpError('Phương án trả khách không hợp lệ', 400)
}

const resolveBookingServiceSelection = (trip, payload = {}) => ({
  pickup: resolvePickup(trip, payload),
  dropoff: resolveDropoff(trip, payload),
})

export { formatLocationSnapshot, resolveBookingServiceSelection }
