import { randomBytes } from 'node:crypto'

import env from '../config/env.js'
import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { normalizeEmail, normalizePhone } from '../utils/normalize.js'
import { MAX_SEATS_PER_BOOKING } from '../validators/booking.validator.js'

const TRANSACTION_OPTIONS = { maxWait: 5000, timeout: 15000 }

const toSafeNumber = (value, fieldName) => {
  const number = Number(value)
  if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number))) {
    throw new HttpError(`Giá trị ${fieldName} không thể chuyển đổi an toàn`, 500)
  }
  return number
}

const serializeSeat = (seat) => ({
  id: seat.id,
  seatCode: seat.seatCode,
  floor: seat.floor,
  seatType: seat.seatType,
  price: toSafeNumber(seat.price, 'giá ghế'),
  status: seat.status,
})

const serializeBooking = (booking) => ({
  id: booking.id,
  bookingCode: booking.bookingCode,
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  totalAmount: toSafeNumber(booking.totalAmount, 'tổng tiền'),
  expiresAt: booking.expiresAt,
  createdAt: booking.createdAt,
  passenger: {
    fullName: booking.passengerFullName,
    phone: booking.passengerPhone,
    email: booking.passengerEmail,
  },
  trip: {
    id: booking.trip.id,
    departureTime: booking.trip.departureTime,
    expectedArrivalTime: booking.trip.expectedArrivalTime,
    route: {
      id: booking.trip.route.id,
      routeName: booking.trip.route.routeName,
      departureLocation: booking.trip.route.departureLocation,
      arrivalLocation: booking.trip.route.arrivalLocation,
    },
    bus: booking.trip.bus,
  },
  seats: booking.items.map((item) => ({
    id: item.tripSeatId,
    seatCode: item.seatCode,
    seatType: item.seatType,
    price: toSafeNumber(item.price, 'giá ghế'),
  })),
})

const lockTrip = async (database, tripId) => {
  await database.$queryRaw`
    SELECT id
    FROM trips
    WHERE id = ${tripId}::uuid
    FOR UPDATE
  `
}

const lockTripSeatIds = async (database, tripSeatIds) => {
  for (const tripSeatId of [...tripSeatIds].sort()) {
    await database.$queryRaw`
      SELECT id
      FROM trip_seats
      WHERE id = ${tripSeatId}::uuid
      FOR UPDATE
    `
  }
}

const ensureOpenFutureTrip = async (database, tripId, now) => {
  const trip = await database.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      departureTime: true,
    },
  })

  if (!trip) {
    throw new HttpError('Không tìm thấy chuyến xe', 404)
  }
  if (trip.status !== 'OPEN' || trip.departureTime <= now) {
    throw new HttpError('Chuyến xe không còn mở để đặt vé', 409)
  }

  return trip
}

const calculateTotal = (seats) => {
  const totalAmount = seats.reduce(
    (sum, seat) => sum + toSafeNumber(seat.price, 'giá ghế'),
    0,
  )
  if (!Number.isSafeInteger(totalAmount)) {
    throw new HttpError('Tổng tiền không thể chuyển đổi an toàn', 500)
  }
  return totalAmount
}

const holdSeats = async (tripId, tripSeatIds) => {
  const uniqueSeatIds = [...new Set(tripSeatIds)]
  const holdToken = randomBytes(32).toString('hex')

  return prisma.$transaction(async (transaction) => {
    const now = new Date()
    const holdExpiresAt = new Date(
      now.getTime() + env.seatHoldMinutes * 60 * 1000,
    )

    await lockTrip(transaction, tripId)
    const trip = await ensureOpenFutureTrip(transaction, tripId, now)

    await transaction.tripSeat.updateMany({
      where: {
        tripId,
        status: 'HELD',
        holdExpiresAt: { lte: now },
      },
      data: { status: 'AVAILABLE', heldBy: null, holdExpiresAt: null },
    })

    await lockTripSeatIds(transaction, uniqueSeatIds)
    const seats = await transaction.tripSeat.findMany({
      where: { id: { in: uniqueSeatIds } },
      select: {
        id: true,
        tripId: true,
        seatCode: true,
        floor: true,
        seatType: true,
        price: true,
        status: true,
      },
      orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }],
    })

    if (
      seats.length !== uniqueSeatIds.length ||
      seats.some((seat) => seat.tripId !== tripId)
    ) {
      throw new HttpError('Một hoặc nhiều ghế không thuộc chuyến xe đã chọn', 400)
    }
    if (seats.some((seat) => seat.status !== 'AVAILABLE')) {
      throw new HttpError(
        'Một hoặc nhiều ghế vừa được khách khác giữ hoặc đặt',
        409,
      )
    }

    const updated = await transaction.tripSeat.updateMany({
      where: {
        tripId,
        id: { in: uniqueSeatIds },
        status: 'AVAILABLE',
      },
      data: { status: 'HELD', heldBy: holdToken, holdExpiresAt },
    })

    if (updated.count !== uniqueSeatIds.length) {
      throw new HttpError(
        'Một hoặc nhiều ghế vừa được khách khác giữ hoặc đặt',
        409,
      )
    }

    return {
      holdToken,
      holdExpiresAt,
      holdDurationMinutes: env.seatHoldMinutes,
      trip: {
        id: trip.id,
        departureTime: trip.departureTime,
      },
      seats: seats.map((seat) => ({ ...serializeSeat(seat), status: 'HELD' })),
      totalAmount: calculateTotal(seats),
    }
  }, TRANSACTION_OPTIONS)
}

const releaseSeatHold = async (tripId, holdToken) => {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true },
  })
  if (!trip) throw new HttpError('Không tìm thấy chuyến xe', 404)

  const result = await prisma.tripSeat.updateMany({
    where: { tripId, status: 'HELD', heldBy: holdToken },
    data: { status: 'AVAILABLE', heldBy: null, holdExpiresAt: null },
  })

  return { releasedSeatCount: result.count }
}

const lockHeldSeatsByToken = (database, tripId, holdToken) =>
  database.$queryRaw`
    SELECT id
    FROM trip_seats
    WHERE trip_id = ${tripId}::uuid
      AND held_by = ${holdToken}
      AND status = 'HELD'
    ORDER BY id
    FOR UPDATE
  `

const generateBookingCode = () =>
  `TN${randomBytes(8).toString('hex').toUpperCase()}`

const bookingInclude = {
  trip: {
    select: {
      id: true,
      departureTime: true,
      expectedArrivalTime: true,
      route: {
        select: {
          id: true,
          routeName: true,
          departureLocation: { select: { id: true, name: true, province: true } },
          arrivalLocation: { select: { id: true, name: true, province: true } },
        },
      },
      bus: {
        select: {
          id: true,
          busName: true,
          licensePlate: true,
          busType: true,
        },
      },
    },
  },
  items: {
    select: {
      tripSeatId: true,
      seatCode: true,
      seatType: true,
      price: true,
    },
    orderBy: { seatCode: 'asc' },
  },
}

const createBookingAttempt = (payload, userId, bookingCode) =>
  prisma.$transaction(async (transaction) => {
    const now = new Date()
    await lockTrip(transaction, payload.tripId)
    await ensureOpenFutureTrip(transaction, payload.tripId, now)

    const lockedRows = await lockHeldSeatsByToken(
      transaction,
      payload.tripId,
      payload.holdToken,
    )
    const tripSeatIds = lockedRows.map((row) => row.id)

    if (
      tripSeatIds.length === 0 ||
      tripSeatIds.length > MAX_SEATS_PER_BOOKING
    ) {
      throw new HttpError('Mã giữ ghế không hợp lệ hoặc đã hết hạn', 409)
    }

    const seats = await transaction.tripSeat.findMany({
      where: { id: { in: tripSeatIds } },
      select: {
        id: true,
        tripId: true,
        seatCode: true,
        seatType: true,
        price: true,
        status: true,
        heldBy: true,
        holdExpiresAt: true,
      },
      orderBy: { seatCode: 'asc' },
    })
    const invalidHold =
      seats.length !== tripSeatIds.length ||
      seats.some(
        (seat) =>
          seat.tripId !== payload.tripId ||
          seat.status !== 'HELD' ||
          seat.heldBy !== payload.holdToken ||
          !seat.holdExpiresAt ||
          seat.holdExpiresAt <= now,
      )

    if (invalidHold) {
      throw new HttpError('Mã giữ ghế không hợp lệ hoặc đã hết hạn', 409)
    }

    const totalAmount = calculateTotal(seats)
    const passengerEmail = payload.passenger.email
      ? normalizeEmail(payload.passenger.email)
      : null
    const booking = await transaction.booking.create({
      data: {
        bookingCode,
        userId: userId || null,
        tripId: payload.tripId,
        passengerFullName: payload.passenger.fullName.trim(),
        passengerPhone: normalizePhone(payload.passenger.phone),
        passengerEmail,
        totalAmount,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        expiresAt: null,
      },
      select: { id: true },
    })

    await transaction.bookingItem.createMany({
      data: seats.map((seat) => ({
        bookingId: booking.id,
        tripSeatId: seat.id,
        seatCode: seat.seatCode,
        seatType: seat.seatType,
        price: seat.price,
      })),
    })

    const updatedSeats = await transaction.tripSeat.updateMany({
      where: {
        id: { in: tripSeatIds },
        tripId: payload.tripId,
        status: 'HELD',
        heldBy: payload.holdToken,
        holdExpiresAt: { gt: now },
      },
      data: { status: 'BOOKED', heldBy: null, holdExpiresAt: null },
    })
    if (updatedSeats.count !== tripSeatIds.length) {
      throw new HttpError('Ghế giữ không còn hợp lệ để tạo booking', 409)
    }

    const result = await transaction.booking.findUnique({
      where: { id: booking.id },
      include: bookingInclude,
    })

    return { booking: serializeBooking(result) }
  }, TRANSACTION_OPTIONS)

const createBooking = async (payload, userId = null) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createBookingAttempt(
        payload,
        userId,
        generateBookingCode(),
      )
    } catch (error) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target
        : [error.meta?.target].filter(Boolean)
      const duplicatedBookingCode =
        error.code === 'P2002' &&
        target.some((field) => String(field).includes('bookingCode'))

      if (!duplicatedBookingCode || attempt === 2) throw error
    }
  }

  throw new HttpError('Không thể tạo mã đặt vé duy nhất', 500)
}

export { createBooking, holdSeats, releaseSeatHold }
