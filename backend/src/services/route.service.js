import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  buildPagination,
  normalizeText,
  parsePagination,
} from '../utils/query.js'
import { writeAuditLog } from './auditLog.service.js'

const routeInclude = {
  departureLocation: true,
  arrivalLocation: true,
}

const ensureActiveLocations = async (departureLocationId, arrivalLocationId) => {
  if (departureLocationId === arrivalLocationId) {
    throw new HttpError('Điểm đi phải khác điểm đến', 400)
  }

  const count = await prisma.location.count({
    where: {
      id: { in: [departureLocationId, arrivalLocationId] },
      status: 'ACTIVE',
    },
  })

  if (count !== 2) {
    throw new HttpError(
      'Điểm đi và điểm đến phải tồn tại và đang hoạt động',
      400,
    )
  }
}

const getRoutes = async ({ query, isAdmin }) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(!isAdmin && { status: 'ACTIVE' }),
    ...(isAdmin && query.status && { status: query.status }),
    ...(query.departureLocation && {
      departureLocationId: query.departureLocation,
    }),
    ...(query.arrivalLocation && {
      arrivalLocationId: query.arrivalLocation,
    }),
    ...(query.keyword && {
      routeName: {
        contains: query.keyword.trim(),
        mode: 'insensitive',
      },
    }),
  }

  const [routes, total] = await Promise.all([
    prisma.route.findMany({
      where,
      include: routeInclude,
      orderBy: { routeName: 'asc' },
      skip,
      take: limit,
    }),
    prisma.route.count({ where }),
  ])

  return { routes, pagination: buildPagination(total, page, limit) }
}

const getRouteById = async ({ routeId, isAdmin }) => {
  const route = await prisma.route.findFirst({
    where: { id: routeId, ...(!isAdmin && { status: 'ACTIVE' }) },
    include: routeInclude,
  })

  if (!route) {
    throw new HttpError('Không tìm thấy tuyến xe', 404)
  }
  return route
}

const createRoute = async (payload, actor = null) => {
  await ensureActiveLocations(
    payload.departureLocation,
    payload.arrivalLocation,
  )

  const duplicate = await prisma.route.findUnique({
    where: {
      departureLocationId_arrivalLocationId: {
        departureLocationId: payload.departureLocation,
        arrivalLocationId: payload.arrivalLocation,
      },
    },
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Tuyến xe giữa hai địa điểm đã tồn tại', 409)
  }

  const route = await prisma.route.create({
    data: {
      routeName: normalizeText(payload.routeName),
      departureLocationId: payload.departureLocation,
      arrivalLocationId: payload.arrivalLocation,
      distanceKm: payload.distanceKm,
      estimatedDurationMinutes: payload.estimatedDurationMinutes,
      defaultTicketPrice: payload.defaultTicketPrice ?? null,
      defaultSingleRoomPrice: payload.defaultSingleRoomPrice ?? null,
      defaultDoubleRoomPrice: payload.defaultDoubleRoomPrice ?? null,
      status: payload.status || 'ACTIVE',
    },
    include: routeInclude,
  })

  if (actor) {
    await writeAuditLog({
      userId: actor.id,
      role: actor.role,
      action: 'CREATE_ROUTE',
      entityType: 'ROUTE',
      entityId: route.id,
      description: 'Tạo tuyến đường mới',
    })
  }

  return route
}

const ensureRouteCanDeactivate = async (routeId) => {
  const futureTripCount = await prisma.trip.count({
    where: {
      routeId,
      departureTime: { gt: new Date() },
      status: { not: 'CANCELLED' },
    },
  })

  if (futureTripCount > 0) {
    throw new HttpError('Không thể khóa tuyến đang có chuyến tương lai', 409)
  }
}

const updateRoute = async (routeId, payload, actor = null) => {
  const route = await prisma.route.findUnique({ where: { id: routeId } })

  if (!route) {
    throw new HttpError('Không tìm thấy tuyến xe', 404)
  }

  const departureLocationId =
    payload.departureLocation || route.departureLocationId
  const arrivalLocationId = payload.arrivalLocation || route.arrivalLocationId

  if (
    payload.departureLocation ||
    payload.arrivalLocation ||
    payload.status === 'ACTIVE'
  ) {
    await ensureActiveLocations(departureLocationId, arrivalLocationId)
  }

  const duplicate = await prisma.route.findFirst({
    where: {
      id: { not: routeId },
      departureLocationId,
      arrivalLocationId,
    },
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Tuyến xe giữa hai địa điểm đã tồn tại', 409)
  }
  if (payload.status === 'INACTIVE' && route.status !== 'INACTIVE') {
    await ensureRouteCanDeactivate(routeId)
  }

  const updatedRoute = await prisma.route.update({
    where: { id: routeId },
    data: {
      departureLocationId,
      arrivalLocationId,
      ...(payload.routeName !== undefined && {
        routeName: normalizeText(payload.routeName),
      }),
      ...(payload.distanceKm !== undefined && {
        distanceKm: payload.distanceKm,
      }),
      ...(payload.estimatedDurationMinutes !== undefined && {
        estimatedDurationMinutes: payload.estimatedDurationMinutes,
      }),
      ...(payload.defaultTicketPrice !== undefined && {
        defaultTicketPrice: payload.defaultTicketPrice,
      }),
      ...(payload.defaultSingleRoomPrice !== undefined && {
        defaultSingleRoomPrice: payload.defaultSingleRoomPrice,
      }),
      ...(payload.defaultDoubleRoomPrice !== undefined && {
        defaultDoubleRoomPrice: payload.defaultDoubleRoomPrice,
      }),
      ...(payload.status && { status: payload.status }),
    },
    include: routeInclude,
  })

  if (actor) {
    await writeAuditLog({
      userId: actor.id,
      role: actor.role,
      action: 'UPDATE_ROUTE',
      entityType: 'ROUTE',
      entityId: routeId,
      description: 'Cập nhật thông tin tuyến đường',
    })
  }

  return updatedRoute
}

const deactivateRoute = async (routeId, actor = null) => {
  const route = await prisma.route.findUnique({ where: { id: routeId } })

  if (!route) {
    throw new HttpError('Không tìm thấy tuyến xe', 404)
  }
  if (route.status === 'INACTIVE') {
    return route
  }

  await ensureRouteCanDeactivate(routeId)
  const updatedRoute = await prisma.route.update({
    where: { id: routeId },
    data: { status: 'INACTIVE' },
    include: routeInclude,
  })

  if (actor) {
    await writeAuditLog({
      userId: actor.id,
      role: actor.role,
      action: 'DELETE_ROUTE',
      entityType: 'ROUTE',
      entityId: routeId,
      description: 'Xóa mềm tuyến đường',
    })
  }

  return updatedRoute
}

export {
  createRoute,
  deactivateRoute,
  getRouteById,
  getRoutes,
  updateRoute,
}
