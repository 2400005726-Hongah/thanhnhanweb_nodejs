import prisma from '../config/prisma.js'
import {
  getPermissionsForRole,
  ROLE_LABELS,
} from '../config/permissions.js'
import HttpError from '../utils/HttpError.js'
import { generateToken } from '../utils/jwt.js'
import { normalizeEmail, normalizeFullName, normalizePhone } from '../utils/normalize.js'
import { comparePassword, hashPassword } from '../utils/password.js'
import { writeAuditLog } from './auditLog.service.js'

const serializeUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  roleLabel: ROLE_LABELS[user.role] || user.role,
  permissions: getPermissionsForRole(user.role),
  status: user.status,
  ...(user.createdAt && { createdAt: user.createdAt }),
  ...(user.updatedAt && { updatedAt: user.updatedAt }),
})

const register = async ({ fullName, email, phone, password }) => {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPhone = normalizePhone(phone)
  const existingUsers = await prisma.user.findMany({
    where: {
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
    select: { email: true, phone: true },
  })

  if (existingUsers.length > 0) {
    const errors = []

    if (existingUsers.some((user) => user.email === normalizedEmail)) {
      errors.push({ field: 'email', message: 'Email đã được sử dụng' })
    }
    if (existingUsers.some((user) => user.phone === normalizedPhone)) {
      errors.push({
        field: 'phone',
        message: 'Số điện thoại đã được sử dụng',
      })
    }

    throw new HttpError(
      'Email hoặc số điện thoại đã được sử dụng',
      409,
      errors,
    )
  }

  const user = await prisma.user.create({
    data: {
      fullName: normalizeFullName(fullName),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash: await hashPassword(password),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  })

  return { user: serializeUser(user), token: generateToken(user) }
}

const login = async ({ identifier, password }) => {
  const isEmail = identifier.includes('@')
  const normalizedIdentifier = isEmail
    ? normalizeEmail(identifier)
    : normalizePhone(identifier)
  const user = await prisma.user.findUnique({
    where: isEmail
      ? { email: normalizedIdentifier }
      : { phone: normalizedIdentifier },
  })
  const isPasswordCorrect = user
    ? await comparePassword(password, user.passwordHash)
    : false

  if (!user || !isPasswordCorrect) {
    throw new HttpError('Thông tin đăng nhập không chính xác', 401)
  }
  if (user.status !== 'ACTIVE') {
    throw new HttpError('Tài khoản đã bị vô hiệu hóa', 403)
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  return {
    user: serializeUser(updatedUser),
    token: generateToken(updatedUser),
  }
}

const adminLogin = async ({ identifier, password }) => {
  const isEmail = identifier.includes('@')
  const normalizedIdentifier = isEmail
    ? normalizeEmail(identifier)
    : normalizePhone(identifier)
  const user = await prisma.user.findUnique({
    where: isEmail
      ? { email: normalizedIdentifier }
      : { phone: normalizedIdentifier },
  })
  const isPasswordCorrect = user
    ? await comparePassword(password, user.passwordHash)
    : false

  if (!user || !isPasswordCorrect) {
    throw new HttpError('Thông tin đăng nhập không chính xác', 401)
  }
  if (user.status !== 'ACTIVE') {
    throw new HttpError('Tài khoản đã bị vô hiệu hóa', 403)
  }
  if (!['ADMIN', 'STAFF'].includes(user.role)) {
    throw new HttpError('Tài khoản này không có quyền truy cập khu vực quản trị', 403)
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await writeAuditLog({
    userId: updatedUser.id,
    role: updatedUser.role,
    actorName: updatedUser.fullName,
    action: 'ADMIN_LOGIN',
    entityType: 'AUTH',
    entityId: updatedUser.id,
    description: `${updatedUser.fullName} đăng nhập khu vực quản trị`,
  })

  return {
    user: serializeUser(updatedUser),
    token: generateToken(updatedUser),
  }
}

const getCurrentUser = (user) => serializeUser(user)

const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user) {
    throw new HttpError('Không tìm thấy tài khoản', 404)
  }
  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw new HttpError('Mật khẩu hiện tại không chính xác', 400)
  }
  if (currentPassword === newPassword) {
    throw new HttpError('Mật khẩu mới phải khác mật khẩu hiện tại', 400)
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  })
}

export { adminLogin, changePassword, getCurrentUser, login, register, serializeUser }
