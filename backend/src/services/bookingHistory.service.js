import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { getCancellationState } from './cancellation.service.js'

const SORT_OPTIONS = {
  createdAtDesc: { createdAt: 'desc' },
  createdAtAsc: { createdAt: 'asc' },
  departureTimeDesc: { trip: { departureTime: 'desc' } },
  departureTimeAsc: { trip: { departureTime: 'asc' } },
}

const toSafeNumber = (value, fieldName) => {
  const number = Number(value)

  if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number))) {
    throw new HttpError(`Giá trị ${fieldName} không thể chuyển đổi an toàn`, 500)
  }

  return number
}

const bookingHistoryInclude = {
  trip: {
    select: {
      id: true,
      departureTime: true,
      expectedArrivalTime: true,
      status: true,
      route: {
        select: {
          routeName: true,
          departureLocation: { select: { name: true, province: true } },
          arrivalLocation: { select: { name: true, province: true } },
        },
      },
      bus: {
        select: {
          busName: true,
          licensePlate: true,
          busType: true,
        },
      },
    },
  },
  items: {
    select: {
      seatCode: true,
      seatType: true,
      price: true,
    },
    orderBy: { seatCode: 'asc' },
  },
  payments: {
    select: {
      paymentMethod: true,
      status: true,
      amount: true,
      paidAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
}

const serializeHistoryBooking = (booking, now = new Date()) => {
  const cancellation = getCancellationState(booking, now)
  const payment = booking.payments[0]

  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    source: booking.source,
    passengerFullName: booking.passengerFullName,
    passengerPhone: booking.passengerPhone,
    passengerEmail: booking.passengerEmail,
    pickupPoint: booking.pickupPoint,
    dropoffPoint: booking.dropoffPoint,
    totalAmount: toSafeNumber(booking.totalAmount, 'tổng tiền'),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    expiresAt: booking.expiresAt,
    createdAt: booking.createdAt,
    trip: booking.trip,
    seats: booking.items.map((item) => ({
      seatCode: item.seatCode,
      seatType: item.seatType,
      price: toSafeNumber(item.price, 'giá ghế'),
    })),
    payment: payment
      ? {
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          amount: toSafeNumber(payment.amount, 'số tiền thanh toán'),
          paidAt: payment.paidAt,
        }
      : null,
    ...cancellation,
  }
}

const listMyBookings = async ({
  userId,
  status,
  paymentStatus,
  page = 1,
  limit = 10,
  sort = 'createdAtDesc',
}) => {
  const where = {
    userId,
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
  }
  const skip = (page - 1) * limit
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingHistoryInclude,
      orderBy: SORT_OPTIONS[sort] || SORT_OPTIONS.createdAtDesc,
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ])

  return {
    bookings: bookings.map((booking) => serializeHistoryBooking(booking)),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  }
}

export {
  SORT_OPTIONS,
  bookingHistoryInclude,
  listMyBookings,
  serializeHistoryBooking,
}
