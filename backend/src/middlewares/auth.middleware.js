import prisma from '../config/prisma.js'
import {
  getPermissionsForRole,
  hasPermission,
} from '../config/permissions.js'
import HttpError from '../utils/HttpError.js'
import { verifyToken } from '../utils/jwt.js'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const authenticate = async (request, _response, next) => {
  const authorizationHeader = request.headers.authorization

  if (!authorizationHeader) {
    next(new HttpError('Bạn chưa đăng nhập', 401))
    return
  }

  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i)

  if (!bearerMatch) {
    next(new HttpError('Authorization header không đúng định dạng Bearer', 401))
    return
  }

  let payload

  try {
    payload = verifyToken(bearerMatch[1])
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Phiên đăng nhập đã hết hạn'
        : 'Token không hợp lệ'
    next(new HttpError(message, 401))
    return
  }

  if (!payload.userId || !uuidPattern.test(payload.userId)) {
    next(new HttpError('Token không hợp lệ', 401))
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      next(new HttpError('Tài khoản không còn tồn tại', 401))
      return
    }

    if (user.status !== 'ACTIVE') {
      next(new HttpError('Tài khoản đã bị vô hiệu hóa', 403))
      return
    }

    request.user = user
    request.permissions = getPermissionsForRole(user.role)
    next()
  } catch (error) {
    next(error)
  }
}

const authorizeRoles = (...roles) => (request, _response, next) => {
  if (!request.user) {
    next(new HttpError('Bạn chưa đăng nhập', 401))
    return
  }

  if (!roles.includes(request.user.role)) {
    next(new HttpError('Bạn không có quyền thực hiện thao tác này', 403))
    return
  }

  next()
}

const authorizePermissions = (...permissions) => (request, _response, next) => {
  if (!request.user) {
    next(new HttpError('Bạn chưa đăng nhập', 401))
    return
  }

  const missingPermission = permissions.find(
    (permission) => !hasPermission(request.user.role, permission),
  )

  if (missingPermission) {
    next(new HttpError('Bạn không có quyền thực hiện thao tác này', 403))
    return
  }

  next()
}

const optionalAuthenticate = (request, response, next) => {
  if (!request.headers.authorization) {
    next()
    return
  }

  return authenticate(request, response, next)
}

export {
  authenticate,
  authorizePermissions,
  authorizeRoles,
  optionalAuthenticate,
}
