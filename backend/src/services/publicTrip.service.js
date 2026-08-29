import prisma from '../config/prisma.js'
import { isRoomBusType } from '../config/busCatalog.js'
import HttpError from '../utils/HttpError.js'
import {
  DROPOFF_KINDS,
  DROPOFF_SERVICE_MODES,
  PICKUP_KINDS,
  PICKUP_SERVICE_MODES,
} from '../config/servicePointCatalog.js'
import { normalizeWhitespace } from '../utils/normalize.js'
import { buildPagination, parsePagination } from '../utils/query.js'
import { getVietnamDateRange, getVietnamDateTime } from '../utils/dateTime.js'
import {
  buildAvailableSeatWhere,
  summarizeTripSeats,
} from './seatAvailability.service.js'
import {
  resolveTripPricing,
  serializeTripPricing,
  toSafeMoneyNumber,
} from './tripPricing.service.js'

const publicLocationSelect = {
  id: true,
  name: true,
  province: true,
  provinceId: true,
  defaultAreaId: true,
  locationType: true,
  address: true,
  provinceRef: { select: { id: true, name: true } },
  defaultArea: { select: { id: true, name: true, sortOrder: true } },
}

const publicTripInclude = {
  route: {
    include: {
      departureLocation: { select: publicLocationSelect },
      arrivalLocation: { select: publicLocationSelect },
    },
  },
  departureLocation: { select: publicLocationSelect },
  arrivalLocation: { select: publicLocationSelect },
  bus: {
    select: {
      id: true,
      busName: true,
      licensePlate: true,
      busType: true,
      capacity: true,
    },
  },
}


const serializeServicePointLocation = (location) => ({
  id: location.id,
  name: location.name,
  province: location.provinceRef?.name || location.province,
  provinceId: location.provinceId || location.provinceRef?.id || null,
  defaultAreaId: location.defaultAreaId || location.defaultArea?.id || null,
  address: location.address,
})

const mapServicePointKind = (point) => {
  if (point.isDefault) {
    return point.pointType === 'PICKUP'
      ? PICKUP_KINDS.PRIMARY
      : DROPOFF_KINDS.PRIMARY
  }
  if (point.pointType === 'PICKUP') {
    return point.serviceMode === PICKUP_SERVICE_MODES.TRANSFER
      ? PICKUP_KINDS.TRANSFER
      : PICKUP_KINDS.MEETING_POINT
  }
  return point.serviceMode === DROPOFF_SERVICE_MODES.TRANSFER
    ? DROPOFF_KINDS.TRANSFER
    : DROPOFF_KINDS.STOP
}

const serializePublicServicePoint = (point, departureTime) => {
  const estimatedMinutes = Number(point.estimatedMinutes || 0)
  const departureMillis = new Date(departureTime).getTime()
  const estimatedDateTime = Number.isFinite(departureMillis)
    ? new Date(departureMillis + estimatedMinutes * 60000).toISOString()
    : null

  return {
    id: point.id,
    pointType: point.pointType,
    serviceMode: point.serviceMode,
    kind: mapServicePointKind(point),
    isDefault: point.isDefault,
    sortOrder: point.sortOrder,
    estimatedMinutes,
    estimatedTime: point.estimatedTime || null,
    estimatedDateTime,
    location: serializeServicePointLocation(point.location),
  }
}

const serializeLocation = (location) => ({
  id: location.id,
  name: location.name,
  province: location.provinceRef?.name || location.province,
  provinceId: location.provinceId || location.provinceRef?.id || null,
  defaultAreaId: location.defaultAreaId || location.defaultArea?.id || null,
  locationType: location.locationType || 'BOTH',
  address: location.address,
})

const serializeTrip = (trip, availableSeatCount) => {
  const pricing = serializeTripPricing(
    resolveTripPricing({
      busType: trip.bus.busType,
      route: trip.route || {},
      ticketPrice: trip.ticketPrice,
      singleRoomPrice: trip.singleRoomPrice,
      doubleRoomPrice: trip.doubleRoomPrice,
    }),
  )

  const departureLocation = trip.departureLocation || trip.route?.departureLocation
  const arrivalLocation = trip.arrivalLocation || trip.route?.arrivalLocation
  const routeName = departureLocation && arrivalLocation
    ? `${departureLocation.name} → ${arrivalLocation.name}`
    : trip.route?.routeName || 'Chưa xác định hành trình'

  return {
    id: trip.id,
    departureTime: trip.departureTime,
    expectedArrivalTime: trip.expectedArrivalTime,
    ...pricing,
    ticketPrice: isRoomBusType(trip.bus.busType)
      ? Math.min(pricing.singleRoomPrice, pricing.doubleRoomPrice)
      : pricing.ticketPrice,
    status: trip.status,
    busType: trip.bus.busType,
    capacity: trip.bus.capacity,
    availableSeatCount,
    departureProvince: departureLocation?.provinceRef || null,
    arrivalProvince: arrivalLocation?.provinceRef || null,
    route: {
      id: trip.route?.id || null,
      routeName,
      departureLocation: departureLocation ? serializeLocation(departureLocation) : null,
      arrivalLocation: arrivalLocation ? serializeLocation(arrivalLocation) : null,
      distanceKm: trip.route?.distanceKm == null
        ? null
        : toSafeMoneyNumber(trip.route.distanceKm, 'khoảng cách'),
      estimatedDurationMinutes: trip.route?.estimatedDurationMinutes ?? null,
      legacy: Boolean(trip.route?.id),
    },
    bus: trip.bus,
  }
}

const getPublicTripSearchCatalog = async () => {
  const provinces = await prisma.province.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      areas: {
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  })

  return { provinces }
}

const normalizeIdList = (value) => {
  if (!value) return []
  const values = Array.isArray(value) ? value : String(value).split(',')
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))]
}

const buildAreaLocationWhere = (provinceId, areaIds = [], usageType) => ({
  status: 'ACTIVE',
  provinceId,
  ...(usageType === 'PICKUP' && { locationType: { in: ['PICKUP', 'BOTH'] } }),
  ...(usageType === 'DROPOFF' && { locationType: { in: ['DROPOFF', 'BOTH'] } }),
  ...(areaIds.length > 0 && { defaultAreaId: { in: areaIds } }),
})

const ensureActiveProvinces = async (departureProvinceId, arrivalProvinceId) => {
  if (departureProvinceId === arrivalProvinceId) {
    throw new HttpError('Tỉnh/Thành đi phải khác Tỉnh/Thành đến', 400)
  }

  const provinces = await prisma.province.findMany({
    where: {
      id: { in: [departureProvinceId, arrivalProvinceId] },
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (provinces.length !== 2) {
    throw new HttpError(
      'Tỉnh/Thành đi hoặc Tỉnh/Thành đến không tồn tại hoặc đã ngừng hoạt động',
      400,
    )
  }
}

const ensureAreasBelongToProvince = async (provinceId, areaIds, label) => {
  if (areaIds.length === 0) return

  const count = await prisma.pickupDropoffArea.count({
    where: {
      id: { in: areaIds },
      provinceId,
      status: 'ACTIVE',
    },
  })

  if (count !== areaIds.length) {
    throw new HttpError(`Bộ lọc ${label} không hợp lệ hoặc không thuộc tỉnh/thành đã chọn`, 400)
  }
}

const getPublicLocations = async ({ keyword }) => {
  const locations = await prisma.location.findMany({
    where: {
      status: 'ACTIVE',
      ...(keyword && {
        OR: ['name', 'province', 'address'].map((field) => ({
          [field]: { contains: normalizeWhitespace(keyword), mode: 'insensitive' },
        })),
      }),
    },
    select: publicLocationSelect,
    orderBy: [{ province: 'asc' }, { name: 'asc' }],
  })

  return { locations }
}

const ensureActiveLocations = async (departureLocationId, arrivalLocationId) => {
  if (departureLocationId === arrivalLocationId) {
    throw new HttpError('Điểm đi phải khác điểm đến', 400)
  }

  const locations = await prisma.location.findMany({
    where: {
      id: { in: [departureLocationId, arrivalLocationId] },
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (locations.length !== 2) {
    throw new HttpError('Điểm đi hoặc điểm đến không tồn tại hoặc đã ngừng hoạt động', 400)
  }
}

const buildDepartureRange = (query, now) => {
  const dateRange = getVietnamDateRange(query.departureDate)
  let lowerBound = dateRange.start > now ? dateRange.start : now
  let upperBound = dateRange.end

  if (query.departureTimeFrom) {
    const from = getVietnamDateTime(query.departureDate, query.departureTimeFrom)
    if (from > lowerBound) lowerBound = from
  }
  if (query.departureTimeTo) {
    const to = getVietnamDateTime(query.departureDate, query.departureTimeTo)
    upperBound = new Date(Math.min(upperBound.getTime(), to.getTime() + 59999))
  }

  return { gte: lowerBound, lt: upperBound }
}

const compareTrips = (left, right, sort) => {
  if (sort === 'departureTimeDesc') {
    return new Date(right.departureTime) - new Date(left.departureTime)
  }
  if (sort === 'priceAsc') return left.ticketPrice - right.ticketPrice
  if (sort === 'priceDesc') return right.ticketPrice - left.ticketPrice
  return new Date(left.departureTime) - new Date(right.departureTime)
}

const searchPublicTrips = async (query) => {
  const { page, limit, skip } = parsePagination(query)
  const now = new Date()
  const departureAreaIds = normalizeIdList(query.departureAreaIds)
  const arrivalAreaIds = normalizeIdList(query.arrivalAreaIds)
  const usesProvinceSearch = Boolean(
    query.departureProvinceId && query.arrivalProvinceId,
  )

  let where

  if (usesProvinceSearch) {
    await ensureActiveProvinces(
      query.departureProvinceId,
      query.arrivalProvinceId,
    )
    await Promise.all([
      ensureAreasBelongToProvince(
        query.departureProvinceId,
        departureAreaIds,
        'điểm đi',
      ),
      ensureAreasBelongToProvince(
        query.arrivalProvinceId,
        arrivalAreaIds,
        'điểm đến',
      ),
    ])

    const departureLocationWhere = buildAreaLocationWhere(
      query.departureProvinceId,
      departureAreaIds,
      'PICKUP',
    )
    const arrivalLocationWhere = buildAreaLocationWhere(
      query.arrivalProvinceId,
      arrivalAreaIds,
      'DROPOFF',
    )

    where = {
      status: 'OPEN',
      salesStatus: 'OPEN',
      operationStatus: 'NOT_DEPARTED',
      departureTime: buildDepartureRange(query, now),
      bus: {
        status: 'ACTIVE',
        ...(query.busType && { busType: query.busType }),
      },
      AND: [
        {
          OR: [
            { departureLocation: departureLocationWhere },
            {
              departureLocationId: null,
              route: {
                is: {
                  status: 'ACTIVE',
                  departureLocation: departureLocationWhere,
                },
              },
            },
          ],
        },
        {
          OR: [
            { arrivalLocation: arrivalLocationWhere },
            {
              arrivalLocationId: null,
              route: {
                is: {
                  status: 'ACTIVE',
                  arrivalLocation: arrivalLocationWhere,
                },
              },
            },
          ],
        },
      ],
    }
  } else {
    await ensureActiveLocations(
      query.departureLocationId,
      query.arrivalLocationId,
    )

    where = {
      status: 'OPEN',
      salesStatus: 'OPEN',
      operationStatus: 'NOT_DEPARTED',
      departureTime: buildDepartureRange(query, now),
      bus: {
        status: 'ACTIVE',
        ...(query.busType && { busType: query.busType }),
      },
      OR: [
        {
          departureLocationId: query.departureLocationId,
          arrivalLocationId: query.arrivalLocationId,
        },
        {
          departureLocationId: null,
          arrivalLocationId: null,
          route: {
            is: {
              status: 'ACTIVE',
              departureLocationId: query.departureLocationId,
              arrivalLocationId: query.arrivalLocationId,
            },
          },
        },
      ],
    }
  }

  const allTrips = await prisma.trip.findMany({
    where,
    include: publicTripInclude,
    orderBy: { departureTime: 'asc' },
  })
  const filteredTrips = allTrips
    .map((trip) => serializeTrip(trip, 0))
    .filter(
      (trip) =>
        (query.minPrice === undefined ||
          trip.ticketPrice >= Number(query.minPrice)) &&
        (query.maxPrice === undefined ||
          trip.ticketPrice <= Number(query.maxPrice)),
    )
    .sort((left, right) => compareTrips(left, right, query.sort))
  const total = filteredTrips.length
  const trips = filteredTrips.slice(skip, skip + limit)

  const availableCounts = trips.length
    ? await prisma.tripSeat.groupBy({
        by: ['tripId'],
        where: {
          tripId: { in: trips.map((trip) => trip.id) },
          ...buildAvailableSeatWhere(now),
        },
        _count: { _all: true },
      })
    : []
  const countByTrip = new Map(
    availableCounts.map((item) => [item.tripId, item._count._all]),
  )

  return {
    trips: trips.map((trip) => ({
      ...trip,
      availableSeatCount: countByTrip.get(trip.id) || 0,
    })),
    pagination: buildPagination(total, page, limit),
  }
}

const getSeatSummary = async (database, tripId, now) => {
  const [groups, expiredHeld] = await Promise.all([
    database.tripSeat.groupBy({
      by: ['status'],
      where: { tripId },
      _count: { _all: true },
    }),
    database.tripSeat.count({
      where: { tripId, status: 'HELD', holdExpiresAt: { lte: now } },
    }),
  ])
  const counts = Object.fromEntries(
    groups.map((group) => [group.status, group._count._all]),
  )

  return {
    total: groups.reduce((sum, group) => sum + group._count._all, 0),
    available: (counts.AVAILABLE || 0) + expiredHeld,
    held: Math.max((counts.HELD || 0) - expiredHeld, 0),
    booked: counts.BOOKED || 0,
  }
}

const findPublicTrip = (database, tripId, now) =>
  database.trip.findFirst({
    where: {
      id: tripId,
      status: { in: ['OPEN', 'CLOSED'] },
      departureTime: { gt: now },
    },
    include: publicTripInclude,
  })

const getPublicTripDetail = async (tripId) => {
  const now = new Date()
  const trip = await findPublicTrip(prisma, tripId, now)
  if (!trip) throw new HttpError('Không tìm thấy chuyến xe phù hợp', 404)

  const summary = await getSeatSummary(prisma, tripId, now)
  return { trip: serializeTrip(trip, summary.available), summary }
}

const getPublicTripSeats = async (tripId) => {
  const now = new Date()
  const trip = await findPublicTrip(prisma, tripId, now)
  if (!trip) throw new HttpError('Không tìm thấy chuyến xe phù hợp', 404)

  await prisma.tripSeat.updateMany({
    where: { tripId, status: 'HELD', holdExpiresAt: { lte: now } },
    data: { status: 'AVAILABLE', heldBy: null, holdExpiresAt: null },
  })

  const seats = await prisma.tripSeat.findMany({
    where: { tripId },
    select: {
      id: true,
      seatCode: true,
      floor: true,
      seatType: true,
      price: true,
      status: true,
    },
    orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }],
  })

  const summary = summarizeTripSeats(seats, now)
  const floors = [...new Set(seats.map((seat) => seat.floor))].map((floor) => ({
    floor,
    seats: seats
      .filter((seat) => seat.floor === floor)
      .map((seat) => ({
        ...seat,
        price: toSafeMoneyNumber(seat.price, 'giá ghế'),
      })),
  }))
  const serializedTrip = serializeTrip(trip, summary.available)

  return {
    trip: {
      id: trip.id,
      departureTime: trip.departureTime,
      busType: serializedTrip.busType,
      capacity: serializedTrip.capacity,
      ticketPrice: serializedTrip.ticketPrice,
      singleRoomPrice: serializedTrip.singleRoomPrice,
      doubleRoomPrice: serializedTrip.doubleRoomPrice,
    },
    summary,
    floors,
  }
}


const getPublicTripServicePoints = async (tripId) => {
  const now = new Date()
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      status: { in: ['OPEN', 'CLOSED'] },
      departureTime: { gt: now },
    },
    select: {
      id: true,
      departureTime: true,
      expectedArrivalTime: true,
      primaryPickupMode: true,
      primaryDropoffMode: true,
      allowPickupTransfer: true,
      allowPickupMeetingPoint: true,
      allowDropoffTransfer: true,
      allowDropoffStop: true,
      departureLocation: { select: publicLocationSelect },
      arrivalLocation: { select: publicLocationSelect },
      route: {
        select: {
          departureLocation: { select: publicLocationSelect },
          arrivalLocation: { select: publicLocationSelect },
        },
      },
      servicePoints: {
        where: {
          status: 'ACTIVE',
          location: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          pointType: true,
          serviceMode: true,
          isDefault: true,
          sortOrder: true,
          estimatedMinutes: true,
          estimatedTime: true,
          location: { select: publicLocationSelect },
        },
        orderBy: [
          { pointType: 'asc' },
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  })

  if (!trip) throw new HttpError('Không tìm thấy chuyến xe phù hợp', 404)

  const departureLocation = trip.departureLocation || trip.route?.departureLocation
  const arrivalLocation = trip.arrivalLocation || trip.route?.arrivalLocation
  const servicePoints = trip.servicePoints
    .map((point) => serializePublicServicePoint(point, trip.departureTime))
    .filter((point) => {
      const primaryLocation = point.pointType === 'PICKUP' ? departureLocation : arrivalLocation
      if (point.isDefault) {
        return point.location?.id === primaryLocation?.id
      }
      if (!primaryLocation?.provinceId || !point.location?.provinceId) return true
      return point.location.provinceId === primaryLocation.provinceId
    })
  const pickupPoints = servicePoints.filter((point) => point.pointType === 'PICKUP')
  const dropoffPoints = servicePoints.filter((point) => point.pointType === 'DROPOFF')

  if (!pickupPoints.some((point) => point.isDefault)) {
    const location = departureLocation
    if (location) {
      pickupPoints.unshift({
        id: null,
        pointType: 'PICKUP',
        serviceMode: trip.primaryPickupMode,
        kind: PICKUP_KINDS.PRIMARY,
        isDefault: true,
        sortOrder: 1,
        estimatedMinutes: 0,
        estimatedTime: trip.departureTime,
        estimatedDateTime: trip.departureTime,
        location: serializeServicePointLocation(location),
      })
    }
  }

  if (!dropoffPoints.some((point) => point.isDefault)) {
    const location = arrivalLocation
    if (location) {
      dropoffPoints.unshift({
        id: null,
        pointType: 'DROPOFF',
        serviceMode: trip.primaryDropoffMode,
        kind: DROPOFF_KINDS.PRIMARY,
        isDefault: true,
        sortOrder: 1,
        estimatedMinutes: Math.max(
          0,
          Math.round((new Date(trip.expectedArrivalTime).getTime() - new Date(trip.departureTime).getTime()) / 60000),
        ),
        estimatedTime: trip.expectedArrivalTime,
        estimatedDateTime: trip.expectedArrivalTime,
        location: serializeServicePointLocation(location),
      })
    }
  }

  return {
    trip: {
      id: trip.id,
      primaryPickupMode: trip.primaryPickupMode,
      primaryDropoffMode: trip.primaryDropoffMode,
      allowPickupTransfer: trip.allowPickupTransfer,
      allowPickupMeetingPoint: trip.allowPickupMeetingPoint,
      allowDropoffTransfer: trip.allowDropoffTransfer,
      allowDropoffStop: trip.allowDropoffStop,
    },
    pickupPoints,
    dropoffPoints,
  }
}

export {
  getPublicLocations,
  getPublicTripSearchCatalog,
  getPublicTripDetail,
  getPublicTripServicePoints,
  getPublicTripSeats,
  searchPublicTrips,
}
