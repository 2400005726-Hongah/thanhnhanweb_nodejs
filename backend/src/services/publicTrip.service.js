import prisma from '../config/prisma.js'
import { isRoomBusType } from '../config/busCatalog.js'
import HttpError from '../utils/HttpError.js'
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
  address: true,
}

const publicTripInclude = {
  route: {
    include: {
      departureLocation: { select: publicLocationSelect },
      arrivalLocation: { select: publicLocationSelect },
    },
  },
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

const serializeLocation = (location) => ({
  id: location.id,
  name: location.name,
  province: location.province,
  address: location.address,
})

const serializeTrip = (trip, availableSeatCount) => {
  const pricing = serializeTripPricing(
    resolveTripPricing({
      busType: trip.bus.busType,
      route: trip.route,
      ticketPrice: trip.ticketPrice,
      singleRoomPrice: trip.singleRoomPrice,
      doubleRoomPrice: trip.doubleRoomPrice,
    }),
  )

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
    route: {
      id: trip.route.id,
      routeName: trip.route.routeName,
      departureLocation: serializeLocation(trip.route.departureLocation),
      arrivalLocation: serializeLocation(trip.route.arrivalLocation),
      distanceKm: toSafeMoneyNumber(trip.route.distanceKm, 'khoảng cách'),
      estimatedDurationMinutes: trip.route.estimatedDurationMinutes,
    },
    bus: trip.bus,
  }
}

const getPublicLocations = async ({ keyword }) => {
  const locations = await prisma.location.findMany({
    where: {
      status: 'ACTIVE',
      ...(keyword && {
        OR: ['name', 'province', 'address'].map((field) => ({
          [field]: { contains: keyword.trim(), mode: 'insensitive' },
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

  await ensureActiveLocations(
    query.departureLocationId,
    query.arrivalLocationId,
  )

  const route = await prisma.route.findFirst({
    where: {
      departureLocationId: query.departureLocationId,
      arrivalLocationId: query.arrivalLocationId,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (!route) {
    return {
      trips: [],
      pagination: buildPagination(0, page, limit),
    }
  }

  const where = {
    routeId: route.id,
    status: 'OPEN',
    departureTime: buildDepartureRange(query, now),
    bus: {
      status: 'ACTIVE',
      ...(query.busType && { busType: query.busType }),
    },
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

export {
  getPublicLocations,
  getPublicTripDetail,
  getPublicTripSeats,
  searchPublicTrips,
}
