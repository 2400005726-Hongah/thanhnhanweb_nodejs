import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  buildPagination,
  normalizeText,
  parsePagination,
} from '../utils/query.js'

const duplicateWhere = (name, province, excludeId) => ({
  ...(excludeId && { id: { not: excludeId } }),
  name: { equals: name, mode: 'insensitive' },
  province: { equals: province, mode: 'insensitive' },
})

const ensureLocationCanDeactivate = async (locationId) => {
  const activeRouteCount = await prisma.route.count({
    where: {
      status: 'ACTIVE',
      OR: [
        { departureLocationId: locationId },
        { arrivalLocationId: locationId },
      ],
    },
  })

  if (activeRouteCount > 0) {
    throw new HttpError(
      'Không thể khóa địa điểm đang được tuyến xe hoạt động sử dụng',
      409,
    )
  }
}

const getLocations = async ({ query, isAdmin }) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(!isAdmin && { status: 'ACTIVE' }),
    ...(isAdmin && query.status && { status: query.status }),
  }

  if (query.keyword) {
    where.OR = ['name', 'province', 'address'].map((field) => ({
      [field]: { contains: query.keyword.trim(), mode: 'insensitive' },
    }))
  }

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where,
      orderBy: [{ province: 'asc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.location.count({ where }),
  ])

  return { locations, pagination: buildPagination(total, page, limit) }
}

const getLocationById = async ({ locationId, isAdmin }) => {
  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      ...(!isAdmin && { status: 'ACTIVE' }),
    },
  })

  if (!location) {
    throw new HttpError('Không tìm thấy địa điểm', 404)
  }
  return location
}

const createLocation = async (payload) => {
  const name = normalizeText(payload.name)
  const province = normalizeText(payload.province)
  const duplicate = await prisma.location.findFirst({
    where: duplicateWhere(name, province),
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Địa điểm đã tồn tại trong tỉnh này', 409)
  }

  return prisma.location.create({
    data: {
      name,
      province,
      address: payload.address ? normalizeText(payload.address) : null,
      status: payload.status || 'ACTIVE',
    },
  })
}

const updateLocation = async (locationId, payload) => {
  const location = await prisma.location.findUnique({ where: { id: locationId } })

  if (!location) {
    throw new HttpError('Không tìm thấy địa điểm', 404)
  }

  const name = payload.name ? normalizeText(payload.name) : location.name
  const province = payload.province
    ? normalizeText(payload.province)
    : location.province
  const duplicate = await prisma.location.findFirst({
    where: duplicateWhere(name, province, locationId),
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Địa điểm đã tồn tại trong tỉnh này', 409)
  }
  if (payload.status === 'INACTIVE' && location.status !== 'INACTIVE') {
    await ensureLocationCanDeactivate(locationId)
  }

  return prisma.location.update({
    where: { id: locationId },
    data: {
      name,
      province,
      ...(payload.address !== undefined && {
        address: payload.address ? normalizeText(payload.address) : null,
      }),
      ...(payload.status && { status: payload.status }),
    },
  })
}

const deactivateLocation = async (locationId) => {
  const location = await prisma.location.findUnique({ where: { id: locationId } })

  if (!location) {
    throw new HttpError('Không tìm thấy địa điểm', 404)
  }
  if (location.status === 'INACTIVE') {
    return location
  }

  await ensureLocationCanDeactivate(locationId)
  return prisma.location.update({
    where: { id: locationId },
    data: { status: 'INACTIVE' },
  })
}

export {
  createLocation,
  deactivateLocation,
  getLocationById,
  getLocations,
  updateLocation,
}
