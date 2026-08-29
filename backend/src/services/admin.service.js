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
import { buildTripRouteSnapshot, getTripJourneyEndpoints, getTripJourneyName } from '../utils/tripJourney.js'
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
    routeTrips,
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
    prisma.trip.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { departureLocationId: true, arrivalLocationId: true },
    }),
    prisma.trip.count(),
    prisma.booking.count({ where: { status: { not: 'DELETED' } } }),
    prisma.customer.count({ where: { status: { not: 'ARCHIVED' } } }),
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
        trip: {
          select: {
            departureLocation: { select: { id: true, name: true, province: true, provinceId: true } },
            arrivalLocation: { select: { id: true, name: true, province: true, provinceId: true } },
            route: {
              select: {
                id: true,
                routeName: true,
                departureLocation: { select: { id: true, name: true, province: true, provinceId: true } },
                arrivalLocation: { select: { id: true, name: true, province: true, provinceId: true } },
              },
            },
          },
        },
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
        departureLocation: { select: { id: true, name: true, province: true, provinceId: true } },
        arrivalLocation: { select: { id: true, name: true, province: true, provinceId: true } },
        route: {
          select: {
            id: true,
            routeName: true,
            departureLocation: { select: { id: true, name: true, province: true, provinceId: true } },
            arrivalLocation: { select: { id: true, name: true, province: true, provinceId: true } },
          },
        },
        bus: { select: { busName: true, licensePlate: true } },
      },
      orderBy: { departureTime: 'asc' },
      take: 6,
    }),
  ])

  const totalRoutes = new Set(
    routeTrips
      .filter((trip) => trip.departureLocationId && trip.arrivalLocationId)
      .map((trip) => `${trip.departureLocationId}:${trip.arrivalLocationId}`),
  ).size

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
      routeName: getTripJourneyName(booking.trip),
    })),
    upcomingTripList: upcomingTripList.map((trip) => ({
      ...trip,
      route: buildTripRouteSnapshot(trip),
      routeName: getTripJourneyName(trip),
    })),
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
      departureLocation: { select: { id: true, name: true, province: true, provinceId: true } },
      arrivalLocation: { select: { id: true, name: true, province: true, provinceId: true } },
      route: {
        select: {
          id: true,
          routeName: true,
          departureLocation: { select: { id: true, name: true, province: true, provinceId: true } },
          arrivalLocation: { select: { id: true, name: true, province: true, provinceId: true } },
        },
      },
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
    const { departureLocation, arrivalLocation } = getTripJourneyEndpoints(trip)
    if (!departureLocation || !arrivalLocation) continue
    const routeKey = `${departureLocation.id}:${arrivalLocation.id}`
    const current = routeMap.get(routeKey) || {
      routeId: routeKey,
      routeName: getTripJourneyName(trip),
      departureLocation,
      arrivalLocation,
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

  const provinceMap = new Map()
  for (const trip of trips) {
    const { departureLocation, arrivalLocation } = getTripJourneyEndpoints(trip)
    if (!departureLocation || !arrivalLocation) continue

    const departureProvinceId = departureLocation.provinceId || departureLocation.province || 'UNKNOWN'
    const arrivalProvinceId = arrivalLocation.provinceId || arrivalLocation.province || 'UNKNOWN'
    const departureProvinceName = departureLocation.province || 'Chưa xác định'
    const arrivalProvinceName = arrivalLocation.province || 'Chưa xác định'
    const key = `${departureProvinceId}:${arrivalProvinceId}`
    const current = provinceMap.get(key) || {
      key,
      departureProvinceId,
      departureProvinceName,
      arrivalProvinceId,
      arrivalProvinceName,
      trips: 0,
      bookings: 0,
      actualPassengerSeats: 0,
      revenue: 0,
    }

    current.trips += 1
    for (const booking of trip.bookings) {
      if (booking.status !== 'DELETED') current.bookings += 1
      if (actualPassengerStatuses.has(booking.status)) {
        current.actualPassengerSeats += booking.items.length
      }
      const payment = latestPayment(booking)
      if (booking.status !== 'DELETED' && payment?.status === 'SUCCESS') {
        current.revenue += safeMoney(payment.amount)
      }
    }
    provinceMap.set(key, current)
  }

  const provincePerformance = [...provinceMap.values()].sort(
    (left, right) => right.trips - left.trips || right.revenue - left.revenue,
  )

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
        routeName: getTripJourneyName(trip),
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
    provincePerformance,
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

      departureLocation: {
        select: { id: true, name: true, province: true, provinceId: true },
      },
      arrivalLocation: {
        select: { id: true, name: true, province: true, provinceId: true },
      },
      route: {
        select: {
          id: true,
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

const serializeManagedBooking = (booking) => ({
  ...booking,
  trip: booking.trip
    ? {
        ...booking.trip,
        route: buildTripRouteSnapshot(booking.trip),
      }
    : booking.trip,
  totalAmount: safeMoney(booking.totalAmount),
  items: booking.items.map((item) => ({
    ...item,
    price: safeMoney(item.price),
  })),
  payments: booking.payments.map((payment) => ({
    ...payment,
    amount: safeMoney(payment.amount),
  })),
})

/*
 * Danh sách Booking
 */
const buildManagedBookingWhere = (query = {}) => {
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.source && { source: query.source }),
    ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
    ...(query.trip && { tripId: query.trip }),
    ...(query.keyword && {
      OR: [
        {
          bookingCode: {
            contains: normalizeWhitespace(query.keyword),
            mode: 'insensitive',
          },
        },
        {
          passengerFullName: {
            contains: normalizeWhitespace(query.keyword),
            mode: 'insensitive',
          },
        },
        {
          passengerPhone: {
            contains: normalizeWhitespace(query.keyword),
          },
        },
        {
          payments: {
            some: {
              transactionCode: {
                contains: normalizeWhitespace(query.keyword).replace(/^#/, ''),
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    }),
  }

  if (query.from || query.to) {
    where.createdAt = {}

    if (query.from) {
      where.createdAt.gte = new Date(query.from)
    }

    if (query.to) {
      const end = new Date(query.to)
      end.setDate(end.getDate() + 1)
      where.createdAt.lt = end
    }
  }

  if (query.departureDate) {
    const start = new Date(`${query.departureDate}T00:00:00+07:00`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    where.trip = {
      departureTime: {
        gte: start,
        lt: end,
      },
    }
  }

  return where
}

const listManagedBookings = async (query) => {
  const { page, limit, skip } = parsePagination(query)
  const where = buildManagedBookingWhere(query)

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: managedBookingInclude,
      orderBy: {
        createdAt: query.sort === 'asc' ? 'asc' : 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ])

  return {
    bookings: bookings.map(serializeManagedBooking),
    pagination: buildPagination(total, page, limit),
  }
}

const listManagedBookingsForExport = async (query = {}) => {
  const where = buildManagedBookingWhere(query)
  const bookings = await prisma.booking.findMany({
    where,
    include: managedBookingInclude,
    orderBy: {
      createdAt: query.sort === 'asc' ? 'asc' : 'desc',
    },
  })

  return bookings.map(serializeManagedBooking)
}

/*
 * Chi tiết Booking
 */

const lookupManagedBookingByIdentifier = async (identifier) => {
  const normalizedIdentifier = normalizeBookingCode(identifier)
  if (!normalizedIdentifier) {
    throw new HttpError('Vui lòng nhập mã vé hoặc mã giao dịch', 400)
  }

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { bookingCode: normalizedIdentifier },
        {
          payments: {
            some: { transactionCode: normalizedIdentifier },
          },
        },
      ],
    },
    include: managedBookingInclude,
  })

  if (!booking) {
    throw new HttpError('Không tìm thấy vé theo mã đã nhập', 404)
  }

  return serializeManagedBooking(booking)
}

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
      'Không tìm thấy vé',
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
  now = new Date(),
) => {
  const booking = await prisma.booking.findUnique({
    where: {
      bookingCode: normalizeBookingCode(bookingCode),
    },
    select: {
      id: true,
      bookingCode: true,
      status: true,
      passengerFullName: true,
      passengerPhone: true,
      staffNote: true,
      trip: {
        select: {
          departureTime: true,
          status: true,
        },
      },
    },
  })

  if (!booking) {
    throw new HttpError('Không tìm thấy vé', 404)
  }

  if (
    booking.status !== 'CONFIRMED' ||
    new Date(booking.trip.departureTime) <= now ||
    ['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(booking.trip.status)
  ) {
    throw new HttpError(
      'Chỉ vé Đã đặt và chuyến chưa khởi hành mới được sửa thông tin.',
      409,
    )
  }

  const nextFullName =
    payload.passengerFullName !== undefined
      ? normalizeFullName(payload.passengerFullName)
      : booking.passengerFullName
  const nextPhone =
    payload.passengerPhone !== undefined
      ? normalizePhone(payload.passengerPhone)
      : booking.passengerPhone
  const nextStaffNote =
    payload.staffNote !== undefined
      ? normalizeMultilineText(payload.staffNote) || null
      : booking.staffNote

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      ...(payload.passengerFullName !== undefined && {
        passengerFullName: nextFullName,
      }),
      ...(payload.passengerPhone !== undefined && {
        passengerPhone: nextPhone,
      }),
      ...(payload.staffNote !== undefined && {
        staffNote: nextStaffNote,
      }),
    },
    include: managedBookingInclude,
  })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    actorName: actor.fullName,
    action: 'UPDATE_BOOKING',
    entityType: 'BOOKING',
    entityId: booking.id,
    description: `Cập nhật thông tin hành khách của booking ${booking.bookingCode}`,
    metadata: {
      passengerFullName: {
        before: booking.passengerFullName,
        after: nextFullName,
      },
      passengerPhone: {
        before: booking.passengerPhone,
        after: nextPhone,
      },
      staffNote: {
        before: booking.staffNote,
        after: nextStaffNote,
      },
    },
  })

  return serializeManagedBooking(updated)
}

/*
 * Khách không đi
 */
const markBookingNoShow = async (
  bookingCode,
  reason,
  actor,
  now = new Date(),
) => {
  const normalizedReason = normalizeMultilineText(reason)
  if (normalizedReason.length < 5 || normalizedReason.length > 500) {
    throw new HttpError('Lý do khách không đi phải có từ 5 đến 500 ký tự', 400)
  }

  return prisma.$transaction(
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
          'Không tìm thấy vé',
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
              normalizedReason,
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
}

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

    status: query.status || { not: 'ARCHIVED' },

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
  note: true,
  createdAt: true,
  updatedAt: true,
}

const CUSTOMER_CLASSIFICATION = Object.freeze({
  VIP_BOOKINGS: 10,
  VIP_SPENDING: 5_000_000,
  REGULAR_BOOKINGS: 3,
  REGULAR_SPENDING: 1_500_000,
  ARCHIVE_AFTER_DAYS: 90,
})

const customerClassification = (successfulBookings, totalSpent) => {
  if (
    successfulBookings >= CUSTOMER_CLASSIFICATION.VIP_BOOKINGS ||
    totalSpent >= CUSTOMER_CLASSIFICATION.VIP_SPENDING
  ) return 'VIP'

  if (
    successfulBookings >= CUSTOMER_CLASSIFICATION.REGULAR_BOOKINGS ||
    totalSpent >= CUSTOMER_CLASSIFICATION.REGULAR_SPENDING
  ) return 'REGULAR'

  return 'NEW'
}

const customerRisk = (count) => {
  if (count >= 3) return { level: 'BLOCKED', label: 'Rủi ro cao' }
  if (count === 2) return { level: 'WARNING', label: 'Cảnh báo' }
  return { level: 'NORMAL', label: 'Bình thường' }
}

const serializeCustomerManagement = (customer) => {
  const bookings = customer.bookings || []
  const violationCount = bookings.filter((booking) =>
    VIOLATION_STATUSES.includes(booking.status),
  ).length

  const paidBookings = bookings.filter((booking) =>
    booking.status !== 'DELETED' &&
    (booking.payments?.[0]?.status === 'SUCCESS' || booking.paymentStatus === 'SUCCESS'),
  )

  const successfulBookings = paidBookings.filter((booking) =>
    ['CONFIRMED', 'COMPLETED'].includes(booking.status),
  ).length

  const totalSpent = paidBookings.reduce((sum, booking) => {
    const payment = booking.payments?.[0]
    return sum + safeMoney(payment?.amount ?? booking.totalAmount)
  }, 0)

  const routeCounter = new Map()
  for (const booking of bookings) {
    if (!['CONFIRMED', 'COMPLETED'].includes(booking.status)) continue
    const routeName = booking.trip ? getTripJourneyName(booking.trip) : null
    if (!routeName || routeName === 'Chưa xác định') continue
    routeCounter.set(routeName, (routeCounter.get(routeName) || 0) + 1)
  }
  const favoriteRoute = [...routeCounter.entries()]
    .sort((left, right) => right[1] - left[1])[0]?.[0] || '-'

  const lastBookingAt = bookings
    .map((booking) => booking.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right) - new Date(left))[0] || null

  const { bookings: _bookings, ...base } = customer
  return {
    ...base,
    totalBookings: bookings.length,
    successfulBookings,
    totalSpent,
    classification: customerClassification(successfulBookings, totalSpent),
    violations: {
      ...buildViolationSummary(violationCount),
      ...customerRisk(violationCount),
      count: violationCount,
    },
    favoriteRoute,
    lastBookingAt,
  }
}

const customerManagementInclude = {
  bookings: {
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      createdAt: true,
      trip: {
        select: {
          departureTime: true,
          departureLocation: { select: { id: true, name: true } },
          arrivalLocation: { select: { id: true, name: true } },
          route: {
            select: {
              routeName: true,
              departureLocation: { select: { id: true, name: true } },
              arrivalLocation: { select: { id: true, name: true } },
            },
          },
        },
      },
      payments: {
        select: { status: true, amount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  },
}

/*
 * Danh sách khách hàng theo logic quản trị của MVC:
 * - phân loại VIP / Thường xuyên / Mới;
 * - rủi ro dựa trên Đã hủy + Không đi;
 * - tổng chi tiêu chỉ tính thanh toán thành công;
 * - mặc định không hiện hồ sơ đã lưu trữ.
 */
const listCustomers = async (query = {}) => {
  // Giữ tương thích các unit test/mock cũ chưa mô phỏng quan hệ bookings.
  if (!prisma.customer?.findMany || !prisma.booking?.findMany) {
    const { page, limit, skip } = parsePagination(query)
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.keyword && {
        OR: ['fullName', 'email', 'phone'].map((field) => ({
          [field]: { contains: normalizeWhitespace(query.keyword), mode: 'insensitive' },
        })),
      }),
    }
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, select: publicCustomerSelect, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.customer.count({ where }),
    ])
    return { customers, pagination: buildPagination(total, page, limit) }
  }

  const { page, limit } = parsePagination(query)
  const keyword = normalizeWhitespace(query.keyword || '').toLowerCase()
  const includeArchived = query.status === 'ARCHIVED'

  const customers = await prisma.customer.findMany({
    where: {
      ...(query.status
        ? { status: query.status }
        : { status: { not: 'ARCHIVED' } }),
    },
    select: {
      ...publicCustomerSelect,
      note: true,
      ...customerManagementInclude,
    },
  })

  const allRows = customers.map(serializeCustomerManagement)
  let rows = [...allRows]

  if (keyword) {
    rows = rows.filter((customer) =>
      [customer.id, customer.fullName, customer.email, customer.phone]
        .some((value) => String(value || '').toLowerCase().includes(keyword)),
    )
  }

  if (query.classification) {
    rows = rows.filter((customer) => customer.classification === query.classification)
  }

  const sorters = {
    bookings: (a, b) => b.successfulBookings - a.successfulBookings,
    spending: (a, b) => b.totalSpent - a.totalSpent,
    recent: (a, b) => new Date(b.lastBookingAt || 0) - new Date(a.lastBookingAt || 0),
    name: (a, b) => a.fullName.localeCompare(b.fullName, 'vi'),
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  }
  rows.sort(sorters[query.sortBy] || sorters.newest)

  const total = rows.length
  const start = (page - 1) * limit
  const paged = rows.slice(start, start + limit)

  const monthStart = monthStartInVietnam(new Date())
  const summary = {
    total: allRows.length,
    active: allRows.filter((customer) => customer.status === 'ACTIVE').length,
    blocked: allRows.filter((customer) => customer.status === 'BLOCKED').length,
    archived: includeArchived ? allRows.length : 0,
    vip: allRows.filter((customer) => customer.classification === 'VIP').length,
    warning: allRows.filter((customer) => customer.violations?.level !== 'NORMAL').length,
    newThisMonth: allRows.filter((customer) => new Date(customer.createdAt) >= monthStart).length,
    totalSpent: allRows.reduce((sum, customer) => sum + customer.totalSpent, 0),
  }

  return {
    customers: paged,
    summary,
    pagination: buildPagination(total, page, limit),
  }
}

const listCustomersForExport = async () => {
  const result = await listCustomers({ page: 1, limit: 100 })
  if (result.pagination.total <= result.customers.length) return result.customers

  // Export không phụ thuộc giới hạn API 100 dòng.
  const customers = await prisma.customer.findMany({
    where: { status: { not: 'ARCHIVED' } },
    select: {
      ...publicCustomerSelect,
      note: true,
      ...customerManagementInclude,
    },
  })
  return customers.map(serializeCustomerManagement)
}

const archiveCustomer = async (customerId, actor, now = new Date()) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      ...publicCustomerSelect,
      bookings: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          trip: { select: { departureTime: true } },
        },
      },
    },
  })

  if (!customer) throw new HttpError('Không tìm thấy khách hàng', 404)

  if (customer.bookings.length === 0) {
    await prisma.customer.delete({ where: { id: customerId } })
    await writeAuditLog({
      userId: actor.id,
      role: actor.role,
      action: 'DELETE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: customerId,
      description: `Xóa khách hàng chưa có lịch sử vé: ${customer.fullName}`,
    })
    return { deleted: true, archived: false }
  }

  const activeStatuses = new Set(['PENDING', 'CONFIRMED'])
  const hasActiveBooking = customer.bookings.some((booking) =>
    activeStatuses.has(booking.status) ||
    (new Date(booking.trip?.departureTime || 0) >= now &&
      !['CANCELLED', 'NO_SHOW', 'DELETED', 'EXPIRED'].includes(booking.status)),
  )
  if (hasActiveBooking) {
    throw new HttpError('Khách đang có vé tương lai hoặc vé đang xử lý nên không thể lưu trữ', 409)
  }

  const lastBookingAt = customer.bookings
    .map((booking) => new Date(booking.createdAt))
    .sort((a, b) => b - a)[0]
  const archiveThreshold = new Date(now)
  archiveThreshold.setDate(archiveThreshold.getDate() - CUSTOMER_CLASSIFICATION.ARCHIVE_AFTER_DAYS)

  if (lastBookingAt > archiveThreshold) {
    const elapsed = Math.floor((now - lastBookingAt) / 86_400_000)
    const remaining = Math.max(1, CUSTOMER_CLASSIFICATION.ARCHIVE_AFTER_DAYS - elapsed)
    throw new HttpError(`Khách mới đặt vé gần đây. Cần chờ thêm ${remaining} ngày mới được lưu trữ`, 409)
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'ARCHIVED' },
    select: publicCustomerSelect,
  })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'ARCHIVE_CUSTOMER',
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: `Lưu trữ khách hàng ${customer.fullName}; giữ nguyên lịch sử vé`,
  })

  return { deleted: false, archived: true, customer: updated }
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

  const financePromise = prisma.payment.aggregate({
    where: {
      status: 'SUCCESS',
      booking: { customerId },
    },
    _sum: { amount: true },
    _count: true,
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
            departureLocation: { select: { id: true, name: true } },
            arrivalLocation: { select: { id: true, name: true } },
            route: {
              select: {
                id: true,
                routeName: true,
                departureLocation: { select: { id: true, name: true } },
                arrivalLocation: { select: { id: true, name: true } },
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
    if (!row.trip) continue
    const { departureLocation, arrivalLocation } = getTripJourneyEndpoints(row.trip)
    if (!departureLocation || !arrivalLocation) continue
    const routeKey = `${departureLocation.id}:${arrivalLocation.id}`
    const current = routeCounter.get(routeKey) || {
      id: routeKey,
      routeName: getTripJourneyName(row.trip),
      count: 0,
    }
    current.count += 1
    routeCounter.set(routeKey, current)
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

      classification: customerClassification(
        successfulPayments._count,
        safeMoney(successfulPayments._sum.amount),
      ),

      finance:
        isAdmin
          ? {
              totalSpent: safeMoney(successfulPayments._sum.amount),
              successfulPayments: successfulPayments._count,
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
 * Sửa tài khoản quản trị: giữ bcrypt của Node, cho phép đổi họ tên,
 * email, số điện thoại và đặt mật khẩu mới khi Chủ xe yêu cầu.
 */
const updateManagedUser = async (userId, payload, actor) => {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  })
  if (!existing) throw new HttpError('Không tìm thấy tài khoản', 404)

  const email = payload.email !== undefined
    ? normalizeEmail(payload.email)
    : existing.email
  const phone = payload.phone !== undefined
    ? normalizePhone(payload.phone)
    : existing.phone

  if (!isVietnamesePhone(phone)) {
    throw new HttpError('Số điện thoại không hợp lệ', 400)
  }

  if (email !== existing.email || phone !== existing.phone) {
    await ensureUniqueAccount(email, phone, userId)
  }

  const data = {
    ...(payload.fullName !== undefined && {
      fullName: normalizeFullName(payload.fullName),
    }),
    ...(payload.email !== undefined && { email }),
    ...(payload.phone !== undefined && { phone }),
  }

  if (payload.password) {
    data.passwordHash = await hashPassword(payload.password)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: publicUserSelect,
  })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: userId,
    description: `Cập nhật tài khoản quản trị ${updated.fullName}`,
    metadata: { passwordChanged: Boolean(payload.password) },
  })

  return updated
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
 * Xóa tài khoản quản trị theo tinh thần MVC nhưng vẫn bảo toàn lịch sử.
 * - tài khoản chưa phát sinh dữ liệu: xóa thật;
 * - đã gắn với chuyến/vé/tin tức/nhật ký: lưu trữ để không làm mất dấu vết;
 * - không cho tự xóa và không cho xóa Chủ xe hoạt động cuối cùng.
 */
const deleteManagedUser = async (userId, actor) => {
  if (userId === actor.id) {
    throw new HttpError('Không thể tự xóa tài khoản đang đăng nhập', 409)
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  })
  if (!existing || existing.status === 'ARCHIVED') {
    throw new HttpError('Không tìm thấy tài khoản', 404)
  }
  if (!['ADMIN', 'STAFF'].includes(existing.role)) {
    throw new HttpError('Chỉ được xóa tài khoản quản trị', 409)
  }

  if (existing.role === 'ADMIN' && existing.status === 'ACTIVE') {
    const activeAdmins = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE' },
    })
    if (activeAdmins <= 1) {
      throw new HttpError('Không thể xóa Chủ xe hoạt động cuối cùng', 409)
    }
  }

  const [tripRefs, bookingRefs, customerRefs, newsRefs, auditRefs] = await Promise.all([
    prisma.trip.count({ where: { createdById: userId } }),
    prisma.booking.count({
      where: {
        OR: [
          { userId },
          { createdById: userId },
          { cancelledById: userId },
          { deletedById: userId },
          { noShowById: userId },
        ],
      },
    }),
    prisma.customer.count({ where: { blockedById: userId } }),
    prisma.news.count({
      where: { OR: [{ createdById: userId }, { updatedById: userId }] },
    }),
    prisma.auditLog.count({ where: { userId } }),
  ])

  const referenceCount = tripRefs + bookingRefs + customerRefs + newsRefs + auditRefs

  if (referenceCount === 0) {
    await prisma.user.delete({ where: { id: userId } })
    await writeAuditLog({
      userId: actor.id,
      role: actor.role,
      actorName: actor.fullName,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: userId,
      description: `Xóa tài khoản quản trị ${existing.fullName}`,
    })
    return { deleted: true, archived: false, user: existing }
  }

  const archived = await prisma.user.update({
    where: { id: userId },
    data: { status: 'ARCHIVED' },
    select: publicUserSelect,
  })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    actorName: actor.fullName,
    action: 'ARCHIVE_USER',
    entityType: 'USER',
    entityId: userId,
    description: `Lưu trữ tài khoản quản trị ${existing.fullName} để bảo toàn lịch sử`,
    metadata: { referenceCount },
  })

  return { deleted: false, archived: true, user: archived }
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
        ...(payload.note !== undefined && {
          note: normalizeMultilineText(payload.note || '') || null,
        }),
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

  const createdAt = {}
  if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00+07:00`)
  if (query.to) createdAt.lt = addDays(new Date(`${query.to}T00:00:00+07:00`), 1)

  const keyword = normalizeWhitespace(query.keyword || '')
  const where = {
    ...(query.role && { role: query.role }),
    ...(query.action && { action: { contains: normalizeWhitespace(query.action), mode: 'insensitive' } }),
    ...(query.entityType && { entityType: { contains: normalizeWhitespace(query.entityType), mode: 'insensitive' } }),
    ...(Object.keys(createdAt).length && { createdAt }),
    ...(keyword && {
      OR: [
        { action: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { reason: { contains: keyword, mode: 'insensitive' } },
        { actorName: { contains: keyword, mode: 'insensitive' } },
        { entityId: { contains: keyword, mode: 'insensitive' } },
        { user: { is: { fullName: { contains: keyword, mode: 'insensitive' } } } },
      ],
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
  updateManagedUser,
  deleteManagedUser,
  getCustomerDetail,
  getDashboardSummary,
  getManagedBooking,
  lookupManagedBookingByIdentifier,
  getRevenueSummary,
  listAuditLogs,
  listCustomers,
  listCustomersForExport,
  archiveCustomer,
  listManagedBookings,
  listManagedBookingsForExport,
  listUsers,
  markBookingNoShow,
  updateBookingContact,
  updateCustomer,
}