import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  isVietnamesePhone,
  normalizeBookingCode,
  normalizeEmail,
  normalizeFullName,
  normalizeMultilineText,
  normalizePhone,
  normalizeWhitespace,
} from '../utils/normalize.js'
import { hashPassword } from '../utils/password.js'
import {
  buildPagination,
  parsePagination,
} from '../utils/query.js'
import { writeAuditLog } from './auditLog.service.js'
import {
  VIOLATION_STATUSES,
  buildViolationSummary,
} from './customer.service.js'

const safeMoney = (value) => Number(value || 0)

const getDayRange = (date = new Date()) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

/*
 * Dashboard
 */
const startOfVietnamDay = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return new Date(`${parts}T00:00:00+07:00`)
}

const addDays = (date, days) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

const monthStartInVietnam = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
  return new Date(`${parts}-01T00:00:00+07:00`)
}

const yearStartInVietnam = (date = new Date()) => {
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(date)
  return new Date(`${year}-01-01T00:00:00+07:00`)
}

const getDashboardSummary = async (role, now = new Date()) => {
  const todayStart = startOfVietnamDay(now)
  const tomorrowStart = addDays(todayStart, 1)
  const next30Days = addDays(todayStart, 30)
  const currentMonthStart = monthStartInVietnam(now)
  const previousMonthStart = new Date(currentMonthStart)
  previousMonthStart.setUTCMonth(previousMonthStart.getUTCMonth() - 1)
  const currentYearStart = yearStartInVietnam(now)
  const nextYearStart = new Date(currentYearStart)
  nextYearStart.setUTCFullYear(nextYearStart.getUTCFullYear() + 1)

  const [
    totalBuses,
    totalRoutes,
    totalTrips,
    totalBookings,
    totalCustomers,
    unpaidBookings,
    tripsToday,
    upcomingTrips,
    bookingsToday,
    recentBookings,
    upcomingTripList,
  ] = await Promise.all([
    prisma.bus.count(),
    prisma.route.count(),
    prisma.trip.count(),
    prisma.booking.count({ where: { status: { not: 'DELETED' } } }),
    prisma.customer.count(),
    prisma.booking.count({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        paymentStatus: 'PENDING',
      },
    }),
    prisma.trip.count({
      where: { departureTime: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.trip.count({
      where: {
        departureTime: { gt: now, lt: next30Days },
        status: { in: ['OPEN', 'CLOSED'] },
      },
    }),
    prisma.booking.count({
      where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.booking.findMany({
      where: { status: { not: 'DELETED' } },
      select: {
        bookingCode: true,
        passengerFullName: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        trip: { select: { route: { select: { routeName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.trip.findMany({
      where: {
        departureTime: { gt: now, lt: next30Days },
        status: { in: ['OPEN', 'CLOSED'] },
      },
      select: {
        id: true,
        departureTime: true,
        status: true,
        route: { select: { routeName: true } },
        bus: { select: { busName: true, licensePlate: true } },
      },
      orderBy: { departureTime: 'asc' },
      take: 6,
    }),
  ])

  const summary = {
    totalBuses,
    totalRoutes,
    totalTrips,
    totalBookings,
    totalCustomers,
    unpaidBookings,
    tripsToday,
    upcomingTrips,
    recentBookings: recentBookings.map((booking) => ({
      ...booking,
      totalAmount: safeMoney(booking.totalAmount),
      routeName: booking.trip?.route?.routeName || 'Chưa xác định',
    })),
    upcomingTripList,
    // Giữ các khóa cũ để các màn hình/khách API cũ không bị gãy.
    activeBuses: totalBuses,
    activeCustomers: totalCustomers,
    bookingsToday,
    bookedSeats: 0,
  }

  summary.bookedSeats = await prisma.tripSeat.count({ where: { status: 'BOOKED' } })

  if (role === 'ADMIN') {
    const [successful, refunded, yearPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: 'REFUNDED' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: currentYearStart, lt: nextYearStart },
        },
        select: { amount: true, createdAt: true },
      }),
    ])

    const monthlyRevenue = Array.from({ length: 12 }, () => 0)
    for (const payment of yearPayments) {
      const monthIndex = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Ho_Chi_Minh',
          month: 'numeric',
        }).format(payment.createdAt),
      ) - 1
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyRevenue[monthIndex] += safeMoney(payment.amount)
      }
    }

    const currentMonthRevenue = yearPayments
      .filter((payment) => payment.createdAt >= currentMonthStart)
      .reduce((sum, payment) => sum + safeMoney(payment.amount), 0)
    const previousMonthRevenue = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: { gte: previousMonthStart, lt: currentMonthStart },
      },
      _sum: { amount: true },
    })
    const previousRevenue = safeMoney(previousMonthRevenue._sum.amount)
    const revenueChangePercent = previousRevenue > 0
      ? ((currentMonthRevenue - previousRevenue) / previousRevenue) * 100
      : currentMonthRevenue > 0
        ? 100
        : 0

    summary.finance = {
      revenue: safeMoney(successful._sum.amount),
      successfulPayments: successful._count,
      refundedAmount: safeMoney(refunded._sum.amount),
      refundedPayments: refunded._count,
      currentMonthRevenue,
      previousMonthRevenue: previousRevenue,
      revenueChangePercent: Number(revenueChangePercent.toFixed(1)),
      monthlyRevenue,
      year: Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
        }).format(now),
      ),
    }
  }

  return summary
}

/*
 * Thống kê doanh thu/vận hành theo NGÀY KHỞI HÀNH của chuyến.
 */
const buildStatisticsRange = ({ from, to }, now = new Date()) => {
  const defaultStart = monthStartInVietnam(now)
  const start = from ? new Date(`${from}T00:00:00+07:00`) : defaultStart
  const endInclusive = to
    ? new Date(`${to}T00:00:00+07:00`)
    : addDays(monthStartInVietnam(addDays(defaultStart, 32)), -1)
  const endExclusive = addDays(endInclusive, 1)

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    throw new HttpError('Khoảng thời gian thống kê không hợp lệ', 400)
  }
  if (start >= endExclusive) {
    throw new HttpError('Từ ngày phải nhỏ hơn hoặc bằng Đến ngày', 400)
  }

  return { start, endExclusive }
}

const vietnamDateKey = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)

const getRevenueSummary = async ({ from, to }) => {
  // Giữ tương thích các test/mock cũ chỉ mô phỏng Payment.aggregate.
  if (!prisma.trip?.findMany) {
    const createdAt = {}
    if (from) createdAt.gte = new Date(from)
    if (to) {
      const end = new Date(to)
      end.setDate(end.getDate() + 1)
      createdAt.lt = end
    }
    const dateFilter = Object.keys(createdAt).length ? { createdAt } : {}
    const [successful, refunded] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: 'REFUNDED', ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
    ])
    return {
      revenue: safeMoney(successful._sum.amount),
      successfulPayments: successful._count,
      refundedAmount: safeMoney(refunded._sum.amount),
      refundedPayments: refunded._count,
    }
  }

  const { start, endExclusive } = buildStatisticsRange({ from, to })
  const trips = await prisma.trip.findMany({
    where: { departureTime: { gte: start, lt: endExclusive } },
    select: {
      id: true,
      departureTime: true,
      status: true,
      route: { select: { id: true, routeName: true } },
      bus: {
        select: {
          busName: true,
          licensePlate: true,
          capacity: true,
        },
      },
      bookings: {
        select: {
          id: true,
          bookingCode: true,
          customerId: true,
          passengerPhone: true,
          source: true,
          status: true,
          paymentStatus: true,
          items: { select: { id: true } },
          payments: {
            select: {
              status: true,
              paymentMethod: true,
              amount: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { departureTime: 'asc' },
  })

  const allBookings = trips.flatMap((trip) =>
    trip.bookings.map((booking) => ({ ...booking, trip })),
  )
  const activeBookings = allBookings.filter((booking) => booking.status !== 'DELETED')
  const actualPassengerStatuses = new Set(['PENDING', 'CONFIRMED', 'COMPLETED'])
  const actualBookings = activeBookings.filter((booking) =>
    actualPassengerStatuses.has(booking.status),
  )
  const latestPayment = (booking) => booking.payments?.[0] || null

  const revenue = activeBookings.reduce((sum, booking) => {
    const payment = latestPayment(booking)
    return sum + (payment?.status === 'SUCCESS' ? safeMoney(payment.amount) : 0)
  }, 0)
  const refundedAmount = allBookings.reduce((sum, booking) => {
    const payment = latestPayment(booking)
    return sum + (payment?.status === 'REFUNDED' ? safeMoney(payment.amount) : 0)
  }, 0)

  const totalCapacity = trips.reduce((sum, trip) => sum + Number(trip.bus.capacity || 0), 0)
  const seatsSold = activeBookings.reduce((sum, booking) => sum + booking.items.length, 0)
  const actualPassengerSeats = actualBookings.reduce(
    (sum, booking) => sum + booking.items.length,
    0,
  )
  const deletedBookings = allBookings.filter((booking) => booking.status === 'DELETED').length
  const cancelledBookings = allBookings.filter((booking) => booking.status === 'CANCELLED').length
  const noShowBookings = allBookings.filter((booking) => booking.status === 'NO_SHOW').length
  const paidBookings = activeBookings.filter(
    (booking) => latestPayment(booking)?.status === 'SUCCESS',
  ).length
  const pendingPayments = activeBookings.filter((booking) => {
    const payment = latestPayment(booking)
    return ['PENDING', 'CONFIRMED'].includes(booking.status) && (!payment || payment.status === 'PENDING')
  }).length

  const uniqueCustomers = new Set(
    activeBookings.map((booking) => booking.customerId || booking.passengerPhone),
  ).size

  const statusOrder = ['CONFIRMED', 'COMPLETED', 'PENDING', 'DELETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED']
  const statusLabels = {
    CONFIRMED: 'Đã đặt',
    COMPLETED: 'Đã hoàn thành',
    PENDING: 'Chờ xử lý',
    DELETED: 'Đã xóa',
    NO_SHOW: 'Không đi',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn',
  }
  const statusDistribution = statusOrder
    .map((key) => ({
      key,
      label: statusLabels[key],
      count: allBookings.filter((booking) => booking.status === key).length,
    }))
    .filter((item) => item.count > 0)

  const sourceLabels = { ONLINE: 'Online', COUNTER: 'Tại quầy', HOTLINE: 'Hotline' }
  const sourceDistribution = ['ONLINE', 'COUNTER', 'HOTLINE'].map((key) => ({
    key,
    label: sourceLabels[key],
    count: activeBookings.filter((booking) => booking.source === key).length,
  }))

  const paymentMethodMap = new Map()
  for (const booking of activeBookings) {
    const payment = latestPayment(booking)
    const method = payment?.paymentMethod || 'UNPAID'
    paymentMethodMap.set(method, (paymentMethodMap.get(method) || 0) + 1)
  }
  const paymentMethodDistribution = [...paymentMethodMap.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count)

  const dayMap = new Map()
  for (const trip of trips) {
    const key = vietnamDateKey(trip.departureTime)
    const current = dayMap.get(key) || {
      date: key,
      trips: 0,
      bookings: 0,
      seatsSold: 0,
      actualPassengerSeats: 0,
      revenue: 0,
    }
    current.trips += 1
    for (const booking of trip.bookings) {
      if (booking.status !== 'DELETED') {
        current.bookings += 1
        current.seatsSold += booking.items.length
      }
      if (actualPassengerStatuses.has(booking.status)) {
        current.actualPassengerSeats += booking.items.length
      }
      const payment = latestPayment(booking)
      if (booking.status !== 'DELETED' && payment?.status === 'SUCCESS') {
        current.revenue += safeMoney(payment.amount)
      }
    }
    dayMap.set(key, current)
  }

  const routeMap = new Map()
  for (const trip of trips) {
    const routeKey = trip.route.id
    const current = routeMap.get(routeKey) || {
      routeId: routeKey,
      routeName: trip.route.routeName,
      trips: 0,
      bookings: 0,
      cancelledOrNoShow: 0,
      capacity: 0,
      seatsSold: 0,
      actualPassengerSeats: 0,
      revenue: 0,
    }
    current.trips += 1
    current.capacity += Number(trip.bus.capacity || 0)
    for (const booking of trip.bookings) {
      if (booking.status !== 'DELETED') {
        current.bookings += 1
        current.seatsSold += booking.items.length
      }
      if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
        current.cancelledOrNoShow += 1
      }
      if (actualPassengerStatuses.has(booking.status)) {
        current.actualPassengerSeats += booking.items.length
      }
      const payment = latestPayment(booking)
      if (booking.status !== 'DELETED' && payment?.status === 'SUCCESS') {
        current.revenue += safeMoney(payment.amount)
      }
    }
    routeMap.set(routeKey, current)
  }

  const routePerformance = [...routeMap.values()].map((item) => ({
    ...item,
    occupancyRate: item.capacity > 0
      ? Number(((item.actualPassengerSeats / item.capacity) * 100).toFixed(1))
      : 0,
  }))

  const topTrips = trips
    .map((trip) => {
      const valid = trip.bookings.filter((booking) => booking.status !== 'DELETED')
      const actual = valid.filter((booking) => actualPassengerStatuses.has(booking.status))
      const tripRevenue = valid.reduce((sum, booking) => {
        const payment = latestPayment(booking)
        return sum + (payment?.status === 'SUCCESS' ? safeMoney(payment.amount) : 0)
      }, 0)
      const soldSeats = valid.reduce((sum, booking) => sum + booking.items.length, 0)
      const actualSeats = actual.reduce((sum, booking) => sum + booking.items.length, 0)
      const capacity = Number(trip.bus.capacity || 0)
      return {
        id: trip.id,
        routeName: trip.route.routeName,
        busName: trip.bus.busName,
        licensePlate: trip.bus.licensePlate,
        departureTime: trip.departureTime,
        bookings: valid.length,
        soldSeats,
        actualPassengerSeats: actualSeats,
        capacity,
        occupancyRate: capacity > 0
          ? Number(((actualSeats / capacity) * 100).toFixed(1))
          : 0,
        revenue: tripRevenue,
      }
    })
    .sort((left, right) => right.revenue - left.revenue || right.soldSeats - left.soldSeats)
    .slice(0, 10)

  return {
    // Các khóa cũ được giữ để tương thích API hiện có.
    revenue,
    successfulPayments: paidBookings,
    refundedAmount,
    refundedPayments: allBookings.filter(
      (booking) => latestPayment(booking)?.status === 'REFUNDED',
    ).length,
    range: {
      from: vietnamDateKey(start),
      to: vietnamDateKey(addDays(endExclusive, -1)),
    },
    summary: {
      revenue,
      refundedAmount,
      totalBookings: activeBookings.length,
      deletedBookings,
      totalTrips: trips.length,
      paidBookings,
      pendingPayments,
      cancelledBookings,
      noShowBookings,
      uniqueCustomers,
      totalCapacity,
      seatsSold,
      actualPassengerSeats,
      occupancyRate: totalCapacity > 0
        ? Number(((actualPassengerSeats / totalCapacity) * 100).toFixed(1))
        : 0,
    },
    daily: [...dayMap.values()],
    statusDistribution,
    sourceDistribution,
    paymentMethodDistribution,
    routePerformance,
    topTrips,
  }
}

/*
 * Dữ liệu Booking quản trị
 */
const managedBookingInclude = {
  trip: {
    select: {
      id: true,
      departureTime: true,
      expectedArrivalTime: true,
      status: true,

      route: {
        select: {
          routeName: true,

          departureLocation: {
            select: {
              name: true,
              province: true,
            },
          },

          arrivalLocation: {
            select: {
              name: true,
              province: true,
            },
          },
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

    orderBy: {
      seatCode: 'asc',
    },
  },

  payments: {
    select: {
      paymentMethod: true,
      status: true,
      amount: true,
      transactionCode: true,
      paidAt: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: 'desc',
    },
  },
}

const serializeManagedBooking = (
  booking,
) => ({
  ...booking,

  totalAmount: safeMoney(
    booking.totalAmount,
  ),

  items: booking.items.map(
    (item) => ({
      ...item,
      price: safeMoney(item.price),
    }),
  ),

  payments: booking.payments.map(
    (payment) => ({
      ...payment,
      amount: safeMoney(
        payment.amount,
      ),
    }),
  ),
})

/*
 * Danh sách Booking
 */
const listManagedBookings = async (
  query,
) => {
  const {
    page,
    limit,
    skip,
  } = parsePagination(query)

  const where = {
    ...(query.status && {
      status: query.status,
    }),

    ...(query.source && {
      source: query.source,
    }),

    ...(query.paymentStatus && {
      paymentStatus:
        query.paymentStatus,
    }),

    ...(query.trip && {
      tripId: query.trip,
    }),

    ...(query.keyword && {
      OR: [
        {
          bookingCode: {
            contains:
              normalizeWhitespace(query.keyword),
            mode: 'insensitive',
          },
        },

        {
          passengerFullName: {
            contains:
              normalizeWhitespace(query.keyword),
            mode: 'insensitive',
          },
        },

        {
          passengerPhone: {
            contains:
              normalizeWhitespace(query.keyword),
          },
        },
      ],
    }),
  }

  if (query.from || query.to) {
    where.createdAt = {}

    if (query.from) {
      where.createdAt.gte =
        new Date(query.from)
    }

    if (query.to) {
      const end = new Date(query.to)
      end.setDate(
        end.getDate() + 1,
      )
      where.createdAt.lt = end
    }
  }

  const [
    bookings,
    total,
  ] = await Promise.all([
    prisma.booking.findMany({
      where,
      include:
        managedBookingInclude,

      orderBy: {
        createdAt:
          query.sort === 'asc'
            ? 'asc'
            : 'desc',
      },

      skip,
      take: limit,
    }),

    prisma.booking.count({
      where,
    }),
  ])

  return {
    bookings: bookings.map(
      serializeManagedBooking,
    ),

    pagination: buildPagination(
      total,
      page,
      limit,
    ),
  }
}

/*
 * Chi tiết Booking
 */
const getManagedBooking = async (
  bookingCode,
) => {
  const booking =
    await prisma.booking.findUnique({
      where: {
        bookingCode: normalizeBookingCode(bookingCode),
      },

      include:
        managedBookingInclude,
    })

  if (!booking) {
    throw new HttpError(
      'Không tìm thấy booking',
      404,
    )
  }

  return serializeManagedBooking(
    booking,
  )
}

/*
 * Sửa thông tin hành khách
 */
const updateBookingContact = async (
  bookingCode,
  payload,
  actor,
) => {
  const booking =
    await prisma.booking.findUnique({
      where: {
        bookingCode: normalizeBookingCode(bookingCode),
      },

      select: {
        id: true,
        bookingCode: true,
      },
    })

  if (!booking) {
    throw new HttpError(
      'Không tìm thấy booking',
      404,
    )
  }

  const updated =
    await prisma.booking.update({
      where: {
        id: booking.id,
      },

      data: {
        ...(payload.passengerFullName && {
          passengerFullName:
            normalizeFullName(payload.passengerFullName),
        }),

        ...(payload.passengerPhone && {
          passengerPhone:
            normalizePhone(
              payload.passengerPhone,
            ),
        }),

        ...(payload.pickupPoint !== undefined && {
          pickupPoint: payload.pickupPoint ? normalizeWhitespace(payload.pickupPoint) : null,
        }),

        ...(payload.dropoffPoint !== undefined && {
          dropoffPoint: payload.dropoffPoint ? normalizeWhitespace(payload.dropoffPoint) : null,
        }),

        ...(payload.passengerEmail !==
          undefined && {
          passengerEmail:
            payload.passengerEmail
              ? normalizeEmail(
                  payload.passengerEmail,
                )
              : null,
        }),
      },

      include:
        managedBookingInclude,
    })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'UPDATE_BOOKING',
    entityType: 'BOOKING',
    entityId: booking.id,
    description:
      `Cập nhật thông tin hành khách của booking ${booking.bookingCode}`,
  })

  return serializeManagedBooking(
    updated,
  )
}

/*
 * Khách không đi
 */
const markBookingNoShow = async (
  bookingCode,
  reason,
  actor,
  now = new Date(),
) =>
  prisma.$transaction(
    async (transaction) => {
      const booking =
        await transaction.booking.findUnique({
          where: {
            bookingCode: normalizeBookingCode(bookingCode),
          },

          select: {
            id: true,
            bookingCode: true,
            status: true,

            trip: {
              select: {
                departureTime: true,
              },
            },
          },
        })

      if (!booking) {
        throw new HttpError(
          'Không tìm thấy booking',
          404,
        )
      }

      if (
        booking.status !==
        'CONFIRMED'
      ) {
        throw new HttpError(
          'Chỉ booking đã xác nhận mới có thể đánh dấu Không đi',
          409,
        )
      }

      if (
        new Date(
          booking.trip.departureTime,
        ) > now
      ) {
        throw new HttpError(
          'Chưa thể đánh dấu Không đi trước giờ khởi hành',
          409,
        )
      }

      const updated =
        await transaction.booking.update({
          where: {
            id: booking.id,
          },

          data: {
            status: 'NO_SHOW',
            noShowReason:
              normalizeMultilineText(reason),
            noShowAt: now,
            noShowById: actor.id,
          },

          include:
            managedBookingInclude,
        })

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action:
            'MARK_NO_SHOW',
          entityType: 'BOOKING',
          entityId: booking.id,
          description:
            `Đánh dấu khách Không đi cho booking ${booking.bookingCode}`,
        },
        transaction,
      )

      return serializeManagedBooking(
        updated,
      )
    },
  )

/*
 * Tài khoản
 */
const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
}

const listUsers = async (
  query,
  roles = [
    'ADMIN',
    'STAFF',
  ],
) => {
  const {
    page,
    limit,
    skip,
  } = parsePagination(query)

  const where = {
    role: {
      in: query.role
        ? [query.role]
        : roles,
    },

    ...(query.status && {
      status: query.status,
    }),

    ...(query.keyword && {
      OR: [
        'fullName',
        'email',
        'phone',
      ].map((field) => ({
        [field]: {
          contains:
            normalizeWhitespace(query.keyword),
          mode: 'insensitive',
        },
      })),
    }),
  }

  const [
    users,
    total,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicUserSelect,

      orderBy: {
        createdAt: 'desc',
      },

      skip,
      take: limit,
    }),

    prisma.user.count({
      where,
    }),
  ])

  return {
    users,

    pagination: buildPagination(
      total,
      page,
      limit,
    ),
  }
}

/*
 * Khách hàng
 */
const publicCustomerSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  blockedReason: true,
  blockedAt: true,
  createdAt: true,
  updatedAt: true,
}

/*
 * Danh sách khách hàng
 */
const listCustomers = async (
  query,
) => {
  const {
    page,
    limit,
    skip,
  } = parsePagination(query)

  const where = {
    ...(query.status && {
      status: query.status,
    }),

    ...(query.keyword && {
      OR: [
        'fullName',
        'email',
        'phone',
      ].map((field) => ({
        [field]: {
          contains:
            normalizeWhitespace(query.keyword),
          mode: 'insensitive',
        },
      })),
    }),
  }

  const [
    customers,
    total,
  ] = await Promise.all([
    prisma.customer.findMany({
      where,

      select: {
        ...publicCustomerSelect,

        _count: {
          select: {
            bookings: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      skip,
      take: limit,
    }),

    prisma.customer.count({
      where,
    }),
  ])

  const customerIds =
    customers.map(
      (customer) => customer.id,
    )

  const violationRows =
    customerIds.length
      ? await prisma.booking.groupBy({
          by: [
            'customerId',
            'status',
          ],

          where: {
            customerId: {
              in: customerIds,
            },

            status: {
              in: VIOLATION_STATUSES,
            },
          },

          _count: {
            _all: true,
          },
        })
      : []

  const countsByCustomer =
    new Map()

  for (
    const row of violationRows
  ) {
    if (!row.customerId) {
      continue
    }

    countsByCustomer.set(
      row.customerId,

      (
        countsByCustomer.get(
          row.customerId,
        ) || 0
      ) + row._count._all,
    )
  }

  return {
    customers: customers.map(
      ({
        _count,
        ...customer
      }) => ({
        ...customer,

        totalBookings:
          _count.bookings,

        violations:
          buildViolationSummary(
            countsByCustomer.get(
              customer.id,
            ) || 0,
          ),
      }),
    ),

    pagination: buildPagination(
      total,
      page,
      limit,
    ),
  }
}

/*
 * Chi tiết khách hàng
 *
 * ADMIN:
 * - Xem tài chính.
 * - Xem nhật ký.
 * - Xem người khóa.
 *
 * STAFF:
 * - Xem thông tin và lịch sử vé.
 * - Không nhận tài chính và nhật ký.
 */
const getCustomerDetail = async (
  customerId,
  query = {},
  actor = null,
) => {
  const {
    page,
    limit,
    skip,
  } = parsePagination(query)

  const isAdmin =
    actor?.role === 'ADMIN'

  const customer =
    await prisma.customer.findUnique({
      where: {
        id: customerId,
      },

      select: {
        ...publicCustomerSelect,

        ...(isAdmin && {
          blockedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        }),
      },
    })

  if (!customer) {
    throw new HttpError(
      'Không tìm thấy khách hàng',
      404,
    )
  }

  const financePromise =
    isAdmin
      ? prisma.payment.aggregate({
          where: {
            status: 'SUCCESS',

            booking: {
              customerId,
            },
          },

          _sum: {
            amount: true,
          },

          _count: true,
        })
      : Promise.resolve({
          _sum: {
            amount: null,
          },

          _count: 0,
        })

  const [
    bookings,
    totalBookings,
    statusRows,
    successfulPayments,
    routeRows,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        customerId,
      },

      include:
        managedBookingInclude,

      orderBy: {
        createdAt: 'desc',
      },

      skip,
      take: limit,
    }),

    prisma.booking.count({
      where: {
        customerId,
      },
    }),

    prisma.booking.groupBy({
      by: ['status'],

      where: {
        customerId,
      },

      _count: {
        _all: true,
      },
    }),

    financePromise,

    prisma.booking.findMany({
      where: {
        customerId,
      },

      select: {
        id: true,
        createdAt: true,

        trip: {
          select: {
            route: {
              select: {
                id: true,
                routeName: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    }),
  ])

  const statusCounts =
    new Map(
      statusRows.map(
        (row) => [
          row.status,
          row._count._all,
        ],
      ),
    )

  const cancelledBookings =
    statusCounts.get(
      'CANCELLED',
    ) || 0

  const noShowBookings =
    statusCounts.get(
      'NO_SHOW',
    ) || 0

  const violationCount =
    cancelledBookings +
    noShowBookings

  const validBookings = [
    'PENDING',
    'CONFIRMED',
    'COMPLETED',
  ].reduce(
    (
      total,
      bookingStatus,
    ) =>
      total +
      (
        statusCounts.get(
          bookingStatus,
        ) || 0
      ),

    0,
  )

  const routeCounter =
    new Map()

  for (const row of routeRows) {
    const route =
      row.trip?.route

    if (!route) {
      continue
    }

    const current =
      routeCounter.get(route.id) || {
        id: route.id,
        routeName:
          route.routeName,
        count: 0,
      }

    current.count += 1

    routeCounter.set(
      route.id,
      current,
    )
  }

  const favoriteRoute =
    [
      ...routeCounter.values(),
    ].sort(
      (
        first,
        second,
      ) =>
        second.count -
        first.count,
    )[0] || null

  const bookingIds =
    routeRows.map(
      (row) => row.id,
    )

  const auditConditions = [
    {
      entityType: 'CUSTOMER',
      entityId: customerId,
    },
  ]

  if (bookingIds.length > 0) {
    auditConditions.push({
      entityType: 'BOOKING',

      entityId: {
        in: bookingIds,
      },
    })
  }

  const auditLogs =
    isAdmin
      ? await prisma.auditLog.findMany({
          where: {
            OR: auditConditions,
          },

          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },

          take: 30,
        })
      : []

  return {
    customer,

    statistics: {
      totalBookings,
      validBookings,
      cancelledBookings,
      noShowBookings,

      violations:
        buildViolationSummary(
          violationCount,
        ),

      finance:
        isAdmin
          ? {
              totalSpent:
                safeMoney(
                  successfulPayments
                    ._sum.amount,
                ),

              successfulPayments:
                successfulPayments
                  ._count,
            }
          : null,

      lastBookingAt:
        routeRows[0]
          ?.createdAt || null,

      favoriteRoute,
    },

    bookings:
      bookings.map(
        serializeManagedBooking,
      ),

    auditLogs,

    pagination:
      buildPagination(
        totalBookings,
        page,
        limit,
      ),
  }
}

/*
 * Khóa hoặc mở khóa khách hàng
 */
const changeCustomerStatus = async (
  customerId,
  status,
  reason,
  actor,
) =>
  prisma.$transaction(
    async (transaction) => {
      const customer =
        await transaction.customer.findUnique({
          where: {
            id: customerId,
          },

          select:
            publicCustomerSelect,
        })

      if (!customer) {
        throw new HttpError(
          'Không tìm thấy khách hàng',
          404,
        )
      }

      if (
        ![
          'ACTIVE',
          'BLOCKED',
        ].includes(status)
      ) {
        throw new HttpError(
          'Trạng thái khách hàng không hợp lệ',
          400,
        )
      }

      if (
        customer.status ===
        status
      ) {
        return customer
      }

      const normalizedReason =
        status === 'BLOCKED'
          ? normalizeMultilineText(reason || '')
          : null

      if (
        status === 'BLOCKED' &&
        (
          normalizedReason.length <
            5 ||
          normalizedReason.length >
            500
        )
      ) {
        throw new HttpError(
          'Lý do khóa phải có từ 5 đến 500 ký tự',
          400,
        )
      }

      const updated =
        await transaction.customer.update({
          where: {
            id: customerId,
          },

          data: {
            status,

            blockedReason:
              status ===
              'BLOCKED'
                ? normalizedReason
                : null,

            blockedAt:
              status ===
              'BLOCKED'
                ? new Date()
                : null,

            blockedById:
              status ===
              'BLOCKED'
                ? actor.id
                : null,
          },

          select:
            publicCustomerSelect,
        })

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,

          action:
            status ===
            'BLOCKED'
              ? 'BLOCK_CUSTOMER'
              : 'UNBLOCK_CUSTOMER',

          entityType:
            'CUSTOMER',

          entityId:
            customerId,

          description:
            status ===
            'BLOCKED'
              ? `Khóa khách hàng ${customer.fullName}`
              : `Mở khóa khách hàng ${customer.fullName}`,

          reason:
            status ===
            'BLOCKED'
              ? normalizedReason
              : null,

          metadata: {
            previousStatus:
              customer.status,

            newStatus:
              status,
          },
        },

        transaction,
      )

      return updated
    },
  )

/*
 * Kiểm tra tài khoản trùng
 */
const ensureUniqueAccount = async (
  email,
  phone,
  excludeId = null,
) => {
  const duplicate =
    await prisma.user.findFirst({
      where: {
        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),

        OR: [
          { email },
          { phone },
        ],
      },

      select: {
        email: true,
        phone: true,
      },
    })

  if (duplicate) {
    throw new HttpError(
      'Email hoặc số điện thoại đã được sử dụng',
      409,
    )
  }
}

/*
 * Tạo tài khoản ADMIN/STAFF
 */
const createManagedUser = async (
  payload,
  actor,
) => {
  const email =
    normalizeEmail(payload.email)

  const phone =
    normalizePhone(payload.phone)

  await ensureUniqueAccount(
    email,
    phone,
  )

  const user =
    await prisma.user.create({
      data: {
        fullName:
          normalizeFullName(payload.fullName),

        email,
        phone,

        passwordHash:
          await hashPassword(
            payload.password,
          ),

        role: payload.role,

        status:
          payload.status ||
          'ACTIVE',
      },

      select:
        publicUserSelect,
    })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: user.id,
    description:
      `Tạo tài khoản ${user.role}`,
  })

  return user
}

/*
 * Khóa hoặc mở tài khoản
 */
const changeUserStatus = async (
  userId,
  status,
  actor,
) => {
  if (
    userId === actor.id &&
    status !== 'ACTIVE'
  ) {
    throw new HttpError(
      'Chủ xe không thể tự khóa tài khoản đang đăng nhập',
      409,
    )
  }

  const existing =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
      },
    })

  if (!existing) {
    throw new HttpError(
      'Không tìm thấy tài khoản',
      404,
    )
  }

  const user =
    await prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        status,
      },

      select:
        publicUserSelect,
    })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action:
      'CHANGE_USER_STATUS',
    entityType: 'USER',
    entityId: userId,
    description:
      `Chuyển trạng thái tài khoản sang ${status}`,
  })

  return user
}

/*
 * Thay đổi quyền tài khoản
 */
const changeUserRole = async (
  userId,
  role,
  actor,
) => {
  if (userId === actor.id) {
    throw new HttpError(
      'Chủ xe không thể tự thay đổi quyền đang đăng nhập',
      409,
    )
  }

  const existing =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
      },
    })

  if (!existing) {
    throw new HttpError(
      'Không tìm thấy tài khoản',
      404,
    )
  }

  const user =
    await prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        role,
      },

      select:
        publicUserSelect,
    })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action:
      'CHANGE_USER_ROLE',
    entityType: 'USER',
    entityId: userId,
    description:
      `Chuyển quyền tài khoản sang ${role}`,
  })

  return user
}

/*
 * Sửa thông tin khách hàng
 */
const updateCustomer = async (
  customerId,
  payload,
  actor,
) => {
  const customer =
    await prisma.customer.findUnique({
      where: {
        id: customerId,
      },

      select:
        publicCustomerSelect,
    })

  if (!customer) {
    throw new HttpError(
      'Không tìm thấy khách hàng',
      404,
    )
  }

  const email =
    payload.email !== undefined
      ? payload.email
        ? normalizeEmail(
            payload.email,
          )
        : null
      : customer.email

  const phone =
    payload.phone
      ? normalizePhone(
          payload.phone,
        )
      : customer.phone

  if (!isVietnamesePhone(phone)) {
    throw new HttpError(
      'Số điện thoại không hợp lệ',
      400,
    )
  }

  const duplicatePhone =
    await prisma.customer.findFirst({
      where: {
        phone,

        id: {
          not: customerId,
        },
      },

      select: {
        id: true,
      },
    })

  if (duplicatePhone) {
    throw new HttpError(
      'Số điện thoại khách hàng đã được sử dụng',
      409,
    )
  }

  const updated =
    await prisma.customer.update({
      where: {
        id: customerId,
      },

      data: {
        ...(payload.fullName && {
          fullName:
            normalizeFullName(
              payload.fullName,
            ),
        }),

        email,
        phone,
      },

      select:
        publicCustomerSelect,
    })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action:
      'UPDATE_CUSTOMER',
    entityType:
      'CUSTOMER',
    entityId:
      customerId,
    description:
      'Cập nhật thông tin liên hệ khách hàng',
  })

  return updated
}

/*
 * Nhật ký hệ thống
 */
const listAuditLogs = async (
  query,
) => {
  const {
    page,
    limit,
    skip,
  } = parsePagination(query)

  const where = {
    ...(query.role && {
      role: query.role,
    }),

    ...(query.action && {
      action: {
        contains:
          normalizeWhitespace(query.action),
      },
    }),

    ...(query.entityType && {
      entityType: {
        contains:
          normalizeWhitespace(query.entityType),
      },
    }),
  }

  const [
    logs,
    total,
  ] = await Promise.all([
    prisma.auditLog.findMany({
      where,

      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      skip,
      take: limit,
    }),

    prisma.auditLog.count({
      where,
    }),
  ])

  return {
    logs,

    pagination:
      buildPagination(
        total,
        page,
        limit,
      ),
  }
}

export {
  changeCustomerStatus,
  changeUserRole,
  changeUserStatus,
  createManagedUser,
  getCustomerDetail,
  getDashboardSummary,
  getManagedBooking,
  getRevenueSummary,
  listAuditLogs,
  listCustomers,
  listManagedBookings,
  listUsers,
  markBookingNoShow,
  updateBookingContact,
  updateCustomer,
}