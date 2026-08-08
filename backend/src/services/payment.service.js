import { randomBytes } from 'node:crypto'

import { assertPaymentMethodAllowed } from '../config/paymentMethods.js'
import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { normalizeBookingCode, normalizePhone } from '../utils/normalize.js'
import { getCancellationState } from './cancellation.service.js'
import { writeAuditLog } from './auditLog.service.js'

const TRANSACTION_OPTIONS = { maxWait: 5000, timeout: 15000 }

const toSafeNumber = (value, fieldName) => {
  const number = Number(value)
  if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number))) {
    throw new HttpError(`Giá trị ${fieldName} không thể chuyển đổi an toàn`, 500)
  }
  return number
}

const publicBookingInclude = {
  trip: {
    select: {
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
      id: true,
      paymentMethod: true,
      amount: true,
      transactionCode: true,
      status: true,
      paidAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
}

const serializePayment = (payment) =>
  payment
    ? {
        paymentMethod: payment.paymentMethod,
        amount: toSafeNumber(payment.amount, 'số tiền thanh toán'),
        transactionCode: payment.transactionCode,
        status: payment.status,
        paidAt: payment.paidAt,
      }
    : null

const serializePublicBooking = (booking) => ({
  bookingCode: booking.bookingCode,
  source: booking.source,
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  totalAmount: toSafeNumber(booking.totalAmount, 'tổng tiền'),
  pickupPoint: booking.pickupPoint,
  dropoffPoint: booking.dropoffPoint,
  passenger: {
    fullName: booking.passengerFullName,
    phone: booking.passengerPhone,
  },
  trip: {
    departureTime: booking.trip.departureTime,
    expectedArrivalTime: booking.trip.expectedArrivalTime,
    status: booking.trip.status,
    route: booking.trip.route,
    bus: booking.trip.bus,
  },
  seats: booking.items.map((item) => ({
    seatCode: item.seatCode,
    seatType: item.seatType,
    price: toSafeNumber(item.price, 'giá ghế'),
  })),
  ...getCancellationState(booking),
})

const lockBookingByCode = (database, bookingCode) =>
  database.$queryRaw`
    SELECT id
    FROM bookings
    WHERE booking_code = ${bookingCode}
    FOR UPDATE
  `

const generateTransactionCode = () =>
  `PAY${randomBytes(10).toString('hex').toUpperCase()}`

const getInitialPaymentPlan = (source, paymentMethod, now = new Date()) => {
  if (!paymentMethod) {
    return null
  }

  assertPaymentMethodAllowed(source, paymentMethod)
  const pending = paymentMethod === 'PAY_AT_BUS'

  return {
    bookingStatus: 'CONFIRMED',
    bookingPaymentStatus: pending ? 'PENDING' : 'SUCCESS',
    bookingExpiresAt: null,
    paymentStatus: pending ? 'PENDING' : 'SUCCESS',
    paidAt: pending ? null : now,
    transactionCode: pending ? null : generateTransactionCode(),
  }
}

const paymentAuditAction = (status) =>
  status === 'SUCCESS' ? 'PAYMENT_SUCCESS' : 'PAYMENT_PENDING'

const createInitialPayment = async ({
  database,
  bookingId,
  source,
  paymentMethod,
  amount,
  actor,
  now = new Date(),
  plan: suppliedPlan,
}) => {
  const plan = suppliedPlan || getInitialPaymentPlan(source, paymentMethod, now)
  if (!plan) return null

  const existingPayment = await database.payment.findFirst({
    where: { bookingId },
    select: { id: true },
  })
  if (existingPayment) {
    throw new HttpError('Booking đã có thông tin thanh toán', 409)
  }

  const payment = await database.payment.create({
    data: {
      bookingId,
      paymentMethod,
      amount,
      transactionCode: plan.transactionCode,
      status: plan.paymentStatus,
      paidAt: plan.paidAt,
    },
    select: {
      id: true,
      paymentMethod: true,
      amount: true,
      transactionCode: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  })

  const auditContext = {
    userId: actor?.id || null,
    role: actor?.role || null,
    actorName: actor?.fullName,
    entityType: 'PAYMENT',
    entityId: payment.id,
    metadata: {
      bookingId,
      paymentMethod,
      status: plan.paymentStatus,
    },
  }
  await writeAuditLog(
    {
      ...auditContext,
      action: 'CREATE_PAYMENT',
      description: `Tạo Payment ${paymentMethod}`,
    },
    database,
  )
  await writeAuditLog(
    {
      ...auditContext,
      action: paymentAuditAction(plan.paymentStatus),
      description:
        plan.paymentStatus === 'SUCCESS'
          ? 'Thanh toán mô phỏng đã được ghi nhận'
          : 'Payment chờ thanh toán tại nhà xe',
    },
    database,
  )

  return { payment, plan }
}

const findMatchingBooking = (database, bookingCode, phone, include) =>
  database.booking.findFirst({
    where: {
      bookingCode,
      passengerPhone: phone,
    },
    ...(include && { include }),
  })

const simulatePaymentAttempt = (
  bookingCode,
  phone,
  paymentMethod,
  transactionCode,
) =>
  prisma.$transaction(async (transaction) => {
    await lockBookingByCode(transaction, bookingCode)

    const booking = await findMatchingBooking(
      transaction,
      bookingCode,
      phone,
      undefined,
    )
    if (!booking) {
      throw new HttpError('Không tìm thấy booking phù hợp', 404)
    }
    if (paymentMethod !== 'SIMULATED') {
      throw new HttpError('Task này chỉ hỗ trợ phương thức SIMULATED', 400)
    }
    assertPaymentMethodAllowed(booking.source, paymentMethod)

    const successfulPayment = await transaction.payment.findFirst({
      where: { bookingId: booking.id, status: 'SUCCESS' },
      select: { id: true },
    })
    if (
      successfulPayment ||
      booking.status !== 'PENDING' ||
      booking.paymentStatus !== 'PENDING'
    ) {
      throw new HttpError('Booking đã được thanh toán hoặc không còn hợp lệ', 409)
    }
    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      throw new HttpError('Booking đã hết thời hạn thanh toán', 409)
    }

    const paidAt = new Date()
    const payment = await transaction.payment.create({
      data: {
        bookingId: booking.id,
        paymentMethod: 'SIMULATED',
        amount: booking.totalAmount,
        transactionCode,
        status: 'SUCCESS',
        paidAt,
      },
      select: {
        id: true,
        paymentMethod: true,
        amount: true,
        transactionCode: true,
        status: true,
        paidAt: true,
      },
    })

    await transaction.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        expiresAt: null,
      },
    })

    const auditContext = {
      userId: null,
      role: null,
      entityType: 'PAYMENT',
      entityId: payment.id,
      metadata: {
        bookingId: booking.id,
        paymentMethod: 'SIMULATED',
        status: 'SUCCESS',
      },
    }
    await writeAuditLog(
      {
        ...auditContext,
        action: 'CREATE_PAYMENT',
        description: 'Tạo Payment SIMULATED',
      },
      transaction,
    )
    await writeAuditLog(
      {
        ...auditContext,
        action: 'PAYMENT_SUCCESS',
        description: 'Thanh toán mô phỏng đã được ghi nhận',
      },
      transaction,
    )

    const updatedBooking = await transaction.booking.findUnique({
      where: { id: booking.id },
      include: publicBookingInclude,
    })

    return {
      booking: serializePublicBooking(updatedBooking),
      payment: serializePayment(payment),
    }
  }, TRANSACTION_OPTIONS)

const simulatePayment = async ({ bookingCode, phone, paymentMethod }) => {
  const normalizedCode = normalizeBookingCode(bookingCode)
  const normalizedPhone = normalizePhone(phone)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await simulatePaymentAttempt(
        normalizedCode,
        normalizedPhone,
        paymentMethod,
        generateTransactionCode(),
      )
    } catch (error) {
      const targets = Array.isArray(error.meta?.target)
        ? error.meta.target
        : [error.meta?.target].filter(Boolean)
      const transactionCodeCollision =
        error.code === 'P2002' &&
        targets.some((field) =>
          String(field).toLowerCase().includes('transaction'),
        )

      if (!transactionCodeCollision || attempt === 2) throw error
    }
  }

  throw new HttpError('Không thể tạo mã giao dịch duy nhất', 500)
}

const lookupBooking = async ({ bookingCode, phone }) => {
  const normalizedCode = normalizeBookingCode(bookingCode)
  const normalizedPhone = normalizePhone(phone)
  const booking = await findMatchingBooking(
    prisma,
    normalizedCode,
    normalizedPhone,
    publicBookingInclude,
  )

  if (!booking) {
    throw new HttpError('Không tìm thấy booking phù hợp', 404)
  }

  return {
    booking: serializePublicBooking(booking),
    payment: serializePayment(booking.payments[0]),
  }
}

export {
  createInitialPayment,
  getInitialPaymentPlan,
  lookupBooking,
  normalizeBookingCode,
  serializePublicBooking,
  simulatePayment,
}
