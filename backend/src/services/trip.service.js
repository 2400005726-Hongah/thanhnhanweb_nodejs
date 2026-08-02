import prisma from '../config/prisma.js'
import {
  getBusCapacity,
  getBusSeatTemplate,
  isManagedBusType,
} from '../config/busCatalog.js'
import HttpError from '../utils/HttpError.js'
import { buildPagination, parsePagination } from '../utils/query.js'
import { writeAuditLog } from './auditLog.service.js'
import { summarizeTripSeats } from './seatAvailability.service.js'
import {
  getTripSeatPrice,
  resolveTripPricing,
  serializeTripPricing,
} from './tripPricing.service.js'

const editableStatuses = ['OPEN', 'CLOSED']
const statusTransitions = {
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['OPEN', 'DEPARTED', 'CANCELLED'],
  DEPARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

const tripInclude = {
  route: {
    include: {
      departureLocation: true,
      arrivalLocation: true,
    },
  },
  bus: {
    select: {
      id: true,
      busName: true,
      licensePlate: true,
      busType: true,
      capacity: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  },
}

const ensureTripReferences = async (database, routeId, busId) => {
  const [route, bus] = await Promise.all([
    database.route.findFirst({
      where: { id: routeId, status: 'ACTIVE' },
    }),
    database.bus.findFirst({
      where: { id: busId, status: 'ACTIVE' },
      include: {
        seats: {
          where: { status: 'ACTIVE' },
          orderBy: { seatCode: 'asc' },
        },
      },
    }),
  ])

  if (!route) {
    throw new HttpError('Tuyến xe không tồn tại hoặc không hoạt động', 400)
  }
  if (!bus) {
    throw new HttpError('Xe không tồn tại hoặc không hoạt động', 400)
  }
  if (bus.seats.length === 0) {
    throw new HttpError('Xe phải có ít nhất một ghế đang hoạt động', 400)
  }
  if (isManagedBusType(bus.busType)) {
    const expectedCapacity = getBusCapacity(bus.busType)
    const expectedSeats = getBusSeatTemplate(bus.busType)
    const actualByCode = new Map(
      bus.seats.map((seat) => [seat.seatCode, seat]),
    )
    const structureMatches =
      bus.capacity === expectedCapacity &&
      bus.seats.length === expectedSeats.length &&
      expectedSeats.every((expected) => {
        const actual = actualByCode.get(expected.seatCode)
        return (
          actual?.floor === expected.floor &&
          actual?.seatType === expected.seatType
        )
      })

    if (!structureMatches) {
      throw new HttpError(
        'Sơ đồ ghế của xe không khớp mẫu chuẩn; không thể tạo chuyến',
        409,
      )
    }
  }

  return { route, bus, activeSeats: bus.seats }
}

const ensureNoScheduleConflict = async (
  database,
  { busId, departureTime, expectedArrivalTime, excludeTripId },
) => {
  const conflict = await database.trip.findFirst({
    where: {
      busId,
      status: { not: 'CANCELLED' },
      departureTime: { lt: expectedArrivalTime },
      expectedArrivalTime: { gt: departureTime },
      ...(excludeTripId && { id: { not: excludeTripId } }),
    },
    select: { id: true },
  })

  if (conflict) {
    throw new HttpError('Xe đã có chuyến bị trùng thời gian', 409)
  }
}

const buildTripSeatData = (tripId, seats, pricing) =>
  seats.map((seat) => ({
    tripId,
    seatId: seat.id,
    seatCode: seat.seatCode,
    floor: seat.floor,
    seatType: seat.seatType,
    price: getTripSeatPrice(pricing, seat.seatType),
    status: 'AVAILABLE',
  }))

const serializeManagedTrip = (trip, now = new Date()) => {
  const pricing = serializeTripPricing(
    resolveTripPricing({
      busType: trip.bus.busType,
      route: trip.route,
      ticketPrice: trip.ticketPrice,
      singleRoomPrice: trip.singleRoomPrice,
      doubleRoomPrice: trip.doubleRoomPrice,
    }),
  )
  const { tripSeats, ...tripData } = trip

  return {
    ...tripData,
    ...pricing,
    ...(tripSeats && { seatStats: summarizeTripSeats(tripSeats, now) }),
  }
}

const getTrips = async ({ query, isAdmin }) => {
  const { page, limit, skip } = parsePagination(query)
  const now = new Date()
  const where = {
    ...(!isAdmin && { status: 'OPEN', departureTime: { gt: now } }),
    ...(isAdmin && query.status && { status: query.status }),
    ...(query.route && { routeId: query.route }),
    ...(isAdmin && query.bus && { busId: query.bus }),
  }

  if (query.departureDate) {
    const start = new Date(query.departureDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    where.departureTime = {
      gte: !isAdmin && start < now ? now : start,
      lt: end,
    }
  }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: {
        ...tripInclude,
        ...(isAdmin && {
          tripSeats: {
            select: { status: true, holdExpiresAt: true },
          },
        }),
      },
      orderBy: { departureTime: query.sort === 'desc' ? 'desc' : 'asc' },
      skip,
      take: limit,
    }),
    prisma.trip.count({ where }),
  ])

  return {
    trips: trips.map((trip) => serializeManagedTrip(trip, now)),
    pagination: buildPagination(total, page, limit),
  }
}

const getTripById = async ({ tripId, isAdmin }) => {
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      ...(!isAdmin && {
        status: 'OPEN',
        departureTime: { gt: new Date() },
      }),
    },
    include: {
      ...tripInclude,
      ...(isAdmin && {
        tripSeats: {
          select: { status: true, holdExpiresAt: true },
        },
      }),
    },
  })

  if (!trip) {
    throw new HttpError('Không tìm thấy chuyến xe', 404)
  }
  return serializeManagedTrip(trip)
}

const createTrip = async (payload, createdById, actor = null) => {
  const departureTime = new Date(payload.departureTime)
  const expectedArrivalTime = new Date(payload.expectedArrivalTime)

  if (departureTime <= new Date()) {
    throw new HttpError('Thời gian khởi hành phải ở tương lai', 400)
  }
  if (expectedArrivalTime <= departureTime) {
    throw new HttpError('Thời gian đến phải sau thời gian khởi hành', 400)
  }

  return prisma.$transaction(async (transaction) => {
    const { route, bus, activeSeats } = await ensureTripReferences(
      transaction,
      payload.route,
      payload.bus,
    )
    await ensureNoScheduleConflict(transaction, {
      busId: payload.bus,
      departureTime,
      expectedArrivalTime,
    })
    const pricing = resolveTripPricing({
      busType: bus.busType,
      route,
      ticketPrice: payload.ticketPrice,
      singleRoomPrice: payload.singleRoomPrice,
      doubleRoomPrice: payload.doubleRoomPrice,
    })

    const trip = await transaction.trip.create({
      data: {
        routeId: payload.route,
        busId: payload.bus,
        departureTime,
        expectedArrivalTime,
        ticketPrice: payload.ticketPrice ?? null,
        singleRoomPrice: payload.singleRoomPrice ?? null,
        doubleRoomPrice: payload.doubleRoomPrice ?? null,
        status: payload.status || 'OPEN',
        createdById,
      },
    })

    await transaction.tripSeat.createMany({
      data: buildTripSeatData(trip.id, activeSeats, pricing),
    })

    const createdTrip = await transaction.trip.findUnique({
      where: { id: trip.id },
      include: tripInclude,
    })

    if (actor) {
      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: 'CREATE_TRIP',
          entityType: 'TRIP',
          entityId: trip.id,
          description: 'Tạo chuyến xe mới',
        },
        transaction,
      )
    }

    return createdTrip
  })
}

const updateTrip = async (tripId, payload, actor = null) =>
  prisma.$transaction(async (transaction) => {
    const trip = await transaction.trip.findUnique({ where: { id: tripId } })

    if (!trip) {
      throw new HttpError('Không tìm thấy chuyến xe', 404)
    }
    if (!editableStatuses.includes(trip.status)) {
      throw new HttpError('Không thể sửa chuyến ở trạng thái hiện tại', 409)
    }

    const nextRouteId = payload.route || trip.routeId
    const nextBusId = payload.bus || trip.busId
    const nextDepartureTime = payload.departureTime
      ? new Date(payload.departureTime)
      : trip.departureTime
    const nextArrivalTime = payload.expectedArrivalTime
      ? new Date(payload.expectedArrivalTime)
      : trip.expectedArrivalTime
    const protectedChange = Boolean(
      payload.route ||
        payload.bus ||
        payload.departureTime ||
        payload.expectedArrivalTime,
    )

    if (protectedChange) {
      const [protectedSeatCount, bookingItemCount] = await Promise.all([
        transaction.tripSeat.count({
          where: {
            tripId,
            status: { in: ['HELD', 'BOOKED'] },
          },
        }),
        transaction.bookingItem.count({
          where: {
            tripSeat: { tripId },
          },
        }),
      ])
      if (protectedSeatCount > 0 || bookingItemCount > 0) {
        throw new HttpError(
          'Không thể đổi tuyến, xe hoặc thời gian khi có ghế đang giữ hoặc lịch sử đặt vé',
          409,
        )
      }
    }

    if (
      nextDepartureTime <= new Date() ||
      nextArrivalTime <= nextDepartureTime
    ) {
      throw new HttpError('Thời gian chuyến xe không hợp lệ', 400)
    }

    const { route, bus, activeSeats } = await ensureTripReferences(
      transaction,
      nextRouteId,
      nextBusId,
    )
    await ensureNoScheduleConflict(transaction, {
      busId: nextBusId,
      departureTime: nextDepartureTime,
      expectedArrivalTime: nextArrivalTime,
      excludeTripId: tripId,
    })

    const busChanged = nextBusId !== trip.busId
    const nextTicketPrice =
      payload.ticketPrice !== undefined ? payload.ticketPrice : trip.ticketPrice
    const nextSingleRoomPrice =
      payload.singleRoomPrice !== undefined
        ? payload.singleRoomPrice
        : trip.singleRoomPrice
    const nextDoubleRoomPrice =
      payload.doubleRoomPrice !== undefined
        ? payload.doubleRoomPrice
        : trip.doubleRoomPrice
    const pricing = resolveTripPricing({
      busType: bus.busType,
      route,
      ticketPrice: nextTicketPrice,
      singleRoomPrice: nextSingleRoomPrice,
      doubleRoomPrice: nextDoubleRoomPrice,
    })
    const pricingChanged =
      payload.ticketPrice !== undefined ||
      payload.singleRoomPrice !== undefined ||
      payload.doubleRoomPrice !== undefined ||
      payload.route !== undefined ||
      payload.bus !== undefined

    if (busChanged) {
      await transaction.tripSeat.deleteMany({ where: { tripId } })
      await transaction.tripSeat.createMany({
        data: buildTripSeatData(tripId, activeSeats, pricing),
      })
    } else if (pricingChanged) {
      await Promise.all([
        transaction.tripSeat.updateMany({
          where: {
            tripId,
            status: 'AVAILABLE',
            seatType: { in: ['NORMAL', 'VIP'] },
          },
          data: { price: pricing.ticketPrice },
        }),
        transaction.tripSeat.updateMany({
          where: { tripId, status: 'AVAILABLE', seatType: 'SINGLE_ROOM' },
          data: { price: pricing.singleRoomPrice ?? pricing.ticketPrice },
        }),
        transaction.tripSeat.updateMany({
          where: { tripId, status: 'AVAILABLE', seatType: 'DOUBLE_ROOM' },
          data: { price: pricing.doubleRoomPrice ?? pricing.ticketPrice },
        }),
      ])
    }

    const updatedTrip = await transaction.trip.update({
      where: { id: tripId },
      data: {
        routeId: nextRouteId,
        busId: nextBusId,
        departureTime: nextDepartureTime,
        expectedArrivalTime: nextArrivalTime,
        ticketPrice: nextTicketPrice,
        singleRoomPrice: nextSingleRoomPrice,
        doubleRoomPrice: nextDoubleRoomPrice,
      },
      include: tripInclude,
    })

    if (actor) {
      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: 'UPDATE_TRIP',
          entityType: 'TRIP',
          entityId: tripId,
          description: 'Cập nhật thông tin chuyến xe',
        },
        transaction,
      )
    }

    return updatedTrip
  })

const changeTripStatus = async (tripId, nextStatus, actor = null) => {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })

  if (!trip) {
    throw new HttpError('Không tìm thấy chuyến xe', 404)
  }
  if (!statusTransitions[trip.status]?.includes(nextStatus)) {
    throw new HttpError(
      `Không thể chuyển trạng thái từ ${trip.status} sang ${nextStatus}`,
      400,
    )
  }
  if (nextStatus === 'OPEN' && trip.departureTime <= new Date()) {
    throw new HttpError('Không thể mở lại chuyến đã đến giờ khởi hành', 400)
  }
  if (nextStatus === 'CANCELLED') {
    const bookedSeatCount = await prisma.tripSeat.count({
      where: { tripId, status: 'BOOKED' },
    })
    if (bookedSeatCount > 0) {
      throw new HttpError(
        'Chưa thể hủy chuyến có vé đã đặt trước khi xử lý hoàn tiền',
        409,
      )
    }
  }

  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: { status: nextStatus },
    include: tripInclude,
  })

  if (actor) {
    await writeAuditLog({
      userId: actor.id,
      role: actor.role,
      action: nextStatus === 'CANCELLED' ? 'CANCEL_TRIP' : 'UPDATE_TRIP_STATUS',
      entityType: 'TRIP',
      entityId: tripId,
      description: `Chuyển trạng thái chuyến xe sang ${nextStatus}`,
    })
  }

  return updatedTrip
}

const cancelTrip = (tripId, actor = null) =>
  changeTripStatus(tripId, 'CANCELLED', actor)

export {
  cancelTrip,
  changeTripStatus,
  createTrip,
  getTripById,
  getTrips,
  updateTrip,
}
