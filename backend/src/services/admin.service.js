import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from '../utils/normalize.js'
import { hashPassword } from '../utils/password.js'
import { buildPagination, parsePagination } from '../utils/query.js'
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

const getDashboardSummary = async (role, now = new Date()) => {
  const { start, end } = getDayRange(now)
  const [
    tripsToday,
    upcomingTrips,
    bookingsToday,
    bookedSeats,
    activeBuses,
    activeCustomers,
  ] = await Promise.all([
    prisma.trip.count({
      where: { departureTime: { gte: start, lt: end } },
    }),
    prisma.trip.count({
      where: { departureTime: { gt: now }, status: { in: ['OPEN', 'CLOSED'] } },
    }),
    prisma.booking.count({
      where: { createdAt: { gte: start, lt: end } },
    }),
    prisma.tripSeat.count({ where: { status: 'BOOKED' } }),
    prisma.bus.count({ where: { status: 'ACTIVE' } }),
    prisma.customer.count({ where: { status: 'ACTIVE' } }),
  ])

  const summary = {
    tripsToday,
    upcomingTrips,
    bookingsToday,
    bookedSeats,
    activeBuses,
    activeCustomers,
  }

  if (role === 'ADMIN') {
    const [successful, refunded] = await Promise.all([
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
    ])
    summary.finance = {
      revenue: safeMoney(successful._sum.amount),
      successfulPayments: successful._count,
      refundedAmount: safeMoney(refunded._sum.amount),
      refundedPayments: refunded._count,
    }
  }

  return summary
}

const getRevenueSummary = async ({ from, to }) => {
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
    select: { seatCode: true, seatType: true, price: true },
    orderBy: { seatCode: 'asc' },
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
    orderBy: { createdAt: 'desc' },
  },
}

const serializeManagedBooking = (booking) => ({
  ...booking,
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

const listManagedBookings = async (query) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.paymentStatus && { paymentStatus: query.paymentStatus }),
    ...(query.trip && { tripId: query.trip }),
    ...(query.keyword && {
      OR: [
        { bookingCode: { contains: query.keyword.trim(), mode: 'insensitive' } },
        {
          passengerFullName: {
            contains: query.keyword.trim(),
            mode: 'insensitive',
          },
        },
        { passengerPhone: { contains: query.keyword.trim() } },
      ],
    }),
  }

  if (query.from || query.to) {
    where.createdAt = {}
    if (query.from) where.createdAt.gte = new Date(query.from)
    if (query.to) {
      const end = new Date(query.to)
      end.setDate(end.getDate() + 1)
      where.createdAt.lt = end
    }
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: managedBookingInclude,
      orderBy: { createdAt: query.sort === 'asc' ? 'asc' : 'desc' },
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

const getManagedBooking = async (bookingCode) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: bookingCode.trim().toUpperCase() },
    include: managedBookingInclude,
  })
  if (!booking) {
    throw new HttpError('Không tìm thấy booking', 404)
  }
  return serializeManagedBooking(booking)
}

const updateBookingContact = async (bookingCode, payload, actor) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: bookingCode.trim().toUpperCase() },
    select: { id: true, bookingCode: true },
  })
  if (!booking) {
    throw new HttpError('Không tìm thấy booking', 404)
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      ...(payload.passengerFullName && {
        passengerFullName: payload.passengerFullName.trim(),
      }),
      ...(payload.passengerPhone && {
        passengerPhone: normalizePhone(payload.passengerPhone),
      }),
      ...(payload.passengerEmail !== undefined && {
        passengerEmail: payload.passengerEmail
          ? normalizeEmail(payload.passengerEmail)
          : null,
      }),
    },
    include: managedBookingInclude,
  })

  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'UPDATE_BOOKING',
    entityType: 'BOOKING',
    entityId: booking.id,
    description: `Cập nhật thông tin hành khách của booking ${booking.bookingCode}`,
  })
  return serializeManagedBooking(updated)
}

const markBookingNoShow = async (bookingCode, reason, actor, now = new Date()) =>
  prisma.$transaction(async (transaction) => {
    const booking = await transaction.booking.findUnique({
      where: { bookingCode: bookingCode.trim().toUpperCase() },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        trip: { select: { departureTime: true } },
      },
    })

    if (!booking) {
      throw new HttpError('Không tìm thấy booking', 404)
    }
    if (booking.status !== 'CONFIRMED') {
      throw new HttpError('Chỉ booking đã xác nhận mới có thể đánh dấu Không đi', 409)
    }
    if (new Date(booking.trip.departureTime) > now) {
      throw new HttpError('Chưa thể đánh dấu Không đi trước giờ khởi hành', 409)
    }

    const updated = await transaction.booking.update({
      where: { id: booking.id },
      data: {
        status: 'NO_SHOW',
        noShowReason: reason.trim(),
        noShowAt: now,
        noShowById: actor.id,
      },
      include: managedBookingInclude,
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        action: 'MARK_NO_SHOW',
        entityType: 'BOOKING',
        entityId: booking.id,
        description: `Đánh dấu khách Không đi cho booking ${booking.bookingCode}`,
      },
      transaction,
    )
    return serializeManagedBooking(updated)
  })

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

const listUsers = async (query, roles = ['CUSTOMER', 'ADMIN', 'STAFF']) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    role: { in: query.role ? [query.role] : roles },
    ...(query.status && { status: query.status }),
    ...(query.keyword && {
      OR: ['fullName', 'email', 'phone'].map((field) => ({
        [field]: { contains: query.keyword.trim(), mode: 'insensitive' },
      })),
    }),
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])
  return { users, pagination: buildPagination(total, page, limit) }
}

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

const listCustomers = async (query) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.keyword && {
      OR: ['fullName', 'email', 'phone'].map((field) => ({
        [field]: { contains: query.keyword.trim(), mode: 'insensitive' },
      })),
    }),
  }
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        ...publicCustomerSelect,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ])

  const customerIds = customers.map((customer) => customer.id)
  const violationRows = customerIds.length
    ? await prisma.booking.groupBy({
        by: ['customerId', 'status'],
        where: {
          customerId: { in: customerIds },
          status: { in: VIOLATION_STATUSES },
        },
        _count: { _all: true },
      })
    : []
  const countsByCustomer = new Map()

  for (const row of violationRows) {
    if (!row.customerId) continue
    countsByCustomer.set(
      row.customerId,
      (countsByCustomer.get(row.customerId) || 0) + row._count._all,
    )
  }

  return {
    customers: customers.map(({ _count, ...customer }) => ({
      ...customer,
      totalBookings: _count.bookings,
      violations: buildViolationSummary(
        countsByCustomer.get(customer.id) || 0,
      ),
    })),
    pagination: buildPagination(total, page, limit),
  }
}

const ensureUniqueAccount = async (email, phone, excludeId = null) => {
  const duplicate = await prisma.user.findFirst({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      OR: [{ email }, { phone }],
    },
    select: { email: true, phone: true },
  })
  if (duplicate) {
    throw new HttpError('Email hoặc số điện thoại đã được sử dụng', 409)
  }
}

const createManagedUser = async (payload, actor) => {
  const email = normalizeEmail(payload.email)
  const phone = normalizePhone(payload.phone)
  await ensureUniqueAccount(email, phone)

  const user = await prisma.user.create({
    data: {
      fullName: payload.fullName.trim(),
      email,
      phone,
      passwordHash: await hashPassword(payload.password),
      role: payload.role,
      status: payload.status || 'ACTIVE',
    },
    select: publicUserSelect,
  })
  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: user.id,
    description: `Tạo tài khoản ${user.role}`,
  })
  return user
}

const changeUserStatus = async (userId, status, actor) => {
  if (userId === actor.id && status !== 'ACTIVE') {
    throw new HttpError('Chủ xe không thể tự khóa tài khoản đang đăng nhập', 409)
  }
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!existing) throw new HttpError('Không tìm thấy tài khoản', 404)

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: publicUserSelect,
  })
  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'CHANGE_USER_STATUS',
    entityType: 'USER',
    entityId: userId,
    description: `Chuyển trạng thái tài khoản sang ${status}`,
  })
  return user
}

const changeUserRole = async (userId, role, actor) => {
  if (userId === actor.id) {
    throw new HttpError('Chủ xe không thể tự thay đổi quyền đang đăng nhập', 409)
  }
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!existing) throw new HttpError('Không tìm thấy tài khoản', 404)

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: publicUserSelect,
  })
  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'CHANGE_USER_ROLE',
    entityType: 'USER',
    entityId: userId,
    description: `Chuyển quyền tài khoản sang ${role}`,
  })
  return user
}

const updateCustomer = async (customerId, payload, actor) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: publicCustomerSelect,
  })
  if (!customer) throw new HttpError('Không tìm thấy khách hàng', 404)

  const email =
    payload.email !== undefined
      ? payload.email
        ? normalizeEmail(payload.email)
        : null
      : customer.email
  const phone = payload.phone ? normalizePhone(payload.phone) : customer.phone
  if (!isVietnamesePhone(phone)) {
    throw new HttpError('Số điện thoại không hợp lệ', 400)
  }
  const duplicatePhone = await prisma.customer.findFirst({
    where: { phone, id: { not: customerId } },
    select: { id: true },
  })
  if (duplicatePhone) {
    throw new HttpError('Số điện thoại khách hàng đã được sử dụng', 409)
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(payload.fullName && {
        fullName: normalizeFullName(payload.fullName),
      }),
      email,
      phone,
    },
    select: publicCustomerSelect,
  })
  await writeAuditLog({
    userId: actor.id,
    role: actor.role,
    action: 'UPDATE_CUSTOMER',
    entityType: 'CUSTOMER',
    entityId: customerId,
    description: 'Cập nhật thông tin liên hệ khách hàng',
  })
  return updated
}

const listAuditLogs = async (query) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(query.role && { role: query.role }),
    ...(query.action && { action: { contains: query.action.trim() } }),
    ...(query.entityType && {
      entityType: { contains: query.entityType.trim() },
    }),
  }
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])
  return { logs, pagination: buildPagination(total, page, limit) }
}

export {
  changeUserRole,
  changeUserStatus,
  createManagedUser,
  getDashboardSummary,
  getManagedBooking,
  getRevenueSummary,
  listAuditLogs,
  listManagedBookings,
  listCustomers,
  listUsers,
  markBookingNoShow,
  updateBookingContact,
  updateCustomer,
}
