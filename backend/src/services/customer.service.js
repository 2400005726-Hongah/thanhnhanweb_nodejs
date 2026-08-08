import HttpError from '../utils/HttpError.js'
import {
  isValidFullName,
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from '../utils/normalize.js'

const VIOLATION_STATUSES = ['CANCELLED', 'NO_SHOW']
const VIOLATION_WARNING_THRESHOLD = 2
const VIOLATION_BLOCK_THRESHOLD = 3

const buildViolationSummary = (count) => ({
  count,
  warning: count >= VIOLATION_WARNING_THRESHOLD,
  blocked: count >= VIOLATION_BLOCK_THRESHOLD,
  level:
    count >= VIOLATION_BLOCK_THRESHOLD
      ? 'BLOCKED'
      : count >= VIOLATION_WARNING_THRESHOLD
        ? 'WARNING'
        : 'NORMAL',
})

const getCustomerViolationSummary = async (database, customerId) => {
  const count = await database.booking.count({
    where: {
      customerId,
      status: { in: VIOLATION_STATUSES },
    },
  })

  return buildViolationSummary(count)
}

const normalizeCustomerProfile = (passenger) => {
  const fullName = normalizeFullName(passenger.fullName)
  const phone = normalizePhone(passenger.phone)
  const email = passenger.email ? normalizeEmail(passenger.email) : null

  if (!isValidFullName(fullName)) {
    throw new HttpError('Họ tên hành khách không hợp lệ', 400)
  }
  if (!isVietnamesePhone(phone)) {
    throw new HttpError('Số điện thoại Việt Nam không hợp lệ', 400)
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError('Email hành khách không hợp lệ', 400)
  }

  return { fullName, phone, email }
}

const findOrCreateBookableCustomer = async (database, passenger) => {
  const profile = normalizeCustomerProfile(passenger)
  const customer = await database.customer.upsert({
    where: { phone: profile.phone },
    create: profile,
    update: {
      fullName: profile.fullName,
      ...(profile.email && { email: profile.email }),
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
    },
  })

  const violations = await getCustomerViolationSummary(database, customer.id)
  if (customer.status === 'BLOCKED') {
  throw new HttpError(
    'Khách hàng đã bị khóa và không được phép đặt vé mới',
    403,
  )
}

if (violations.blocked) {
  throw new HttpError(
    'Khách hàng đã bị chặn đặt vé do có từ 3 lần vi phạm trở lên',
    403,
  )
}

  return { customer, violations }
}

export {
  VIOLATION_BLOCK_THRESHOLD,
  VIOLATION_STATUSES,
  VIOLATION_WARNING_THRESHOLD,
  buildViolationSummary,
  findOrCreateBookableCustomer,
  getCustomerViolationSummary,
  normalizeCustomerProfile,
}
