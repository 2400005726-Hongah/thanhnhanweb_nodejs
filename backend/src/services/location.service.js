import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import {
  normalizeAddress,
  normalizeComparisonKey,
  normalizeLocationName,
  normalizeProvince,
  normalizeWhitespace,
} from '../utils/normalize.js'
import { buildPagination, parsePagination } from '../utils/query.js'

const LOCATION_PROVINCE_RULES = new Map(
  [
    ['Ea Tân', 'Đắk Lắk'],
    ['Ea Tóh', 'Đắk Lắk'],
    ['Phú Lộc', 'Đắk Lắk'],
    ['Dliê Ya', 'Đắk Lắk'],
    ['Thị trấn Krông Năng', 'Đắk Lắk'],
    ['Ea Hồ', 'Đắk Lắk'],
    ['Buôn Hồ', 'Đắk Lắk'],
    ['Krông Búk', 'Đắk Lắk'],
    ['Cư M’gar', 'Đắk Lắk'],
    ['Buôn Ma Thuột', 'Đắk Lắk'],
    ['Bình Thạnh', 'TP.HCM'],
    ['Gò Vấp', 'TP.HCM'],
    ['Phú Nhuận', 'TP.HCM'],
    ['Quận 1', 'TP.HCM'],
    ['Quận 3', 'TP.HCM'],
    ['Quận 5', 'TP.HCM'],
    ['Quận 6', 'TP.HCM'],
    ['Quận 10', 'TP.HCM'],
    ['Quận 11', 'TP.HCM'],
    ['Quận 12', 'TP.HCM'],
    ['Tân Bình', 'TP.HCM'],
    ['Tân Phú', 'TP.HCM'],
    ['Thủ Đức', 'TP.HCM'],
    ['Dĩ An', 'Bình Dương'],
    ['Phú Giáo', 'Bình Dương'],
    ['Tân Uyên', 'Bình Dương'],
    ['Thuận An', 'Bình Dương'],
    ['Chơn Thành', 'Bình Dương'],
  ].map(([name, province]) => [normalizeComparisonKey(name), province]),
)

const normalizeLocationPayload = (payload, current = {}) => {
  const name =
    payload.name !== undefined
      ? normalizeLocationName(payload.name)
      : current.name
  const province =
    payload.province !== undefined
      ? normalizeProvince(payload.province)
      : current.province
  const expectedProvince = LOCATION_PROVINCE_RULES.get(
    normalizeComparisonKey(name),
  )

  if (
    expectedProvince &&
    normalizeComparisonKey(province) !== normalizeComparisonKey(expectedProvince)
  ) {
    throw new HttpError(
      `${name} phải thuộc ${expectedProvince} theo danh mục địa điểm của hệ thống`,
      400,
    )
  }

  return {
    name,
    province: expectedProvince || province,
    address:
      payload.address !== undefined
        ? normalizeAddress(payload.address)
        : current.address ?? null,
  }
}

const findDuplicateLocation = async ({ name, province, excludeId }) =>
  prisma.location.findFirst({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      name: { equals: name, mode: 'insensitive' },
      province: { equals: province, mode: 'insensitive' },
    },
    select: { id: true },
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
      'Không thể ngừng hoạt động địa điểm đang được tuyến xe hoạt động sử dụng',
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
    const keyword = normalizeWhitespace(query.keyword)
    const canonicalName = normalizeLocationName(keyword)
    const canonicalProvince = normalizeProvince(keyword)
    const terms = [...new Set([keyword, canonicalName, canonicalProvince])]

    where.OR = terms.flatMap((term) =>
      ['name', 'province', 'address'].map((field) => ({
        [field]: { contains: term, mode: 'insensitive' },
      })),
    )
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
  const normalized = normalizeLocationPayload(payload)
  const duplicate = await findDuplicateLocation(normalized)

  if (duplicate) {
    throw new HttpError('Địa điểm đã tồn tại trong tỉnh/thành phố này', 409)
  }

  return prisma.location.create({
    data: {
      ...normalized,
      status: payload.status || 'ACTIVE',
    },
  })
}

const updateLocation = async (locationId, payload) => {
  const location = await prisma.location.findUnique({ where: { id: locationId } })

  if (!location) {
    throw new HttpError('Không tìm thấy địa điểm', 404)
  }

  const normalized = normalizeLocationPayload(payload, location)
  const duplicate = await findDuplicateLocation({
    ...normalized,
    excludeId: locationId,
  })

  if (duplicate) {
    throw new HttpError('Địa điểm đã tồn tại trong tỉnh/thành phố này', 409)
  }
  if (payload.status === 'INACTIVE' && location.status !== 'INACTIVE') {
    await ensureLocationCanDeactivate(locationId)
  }

  return prisma.location.update({
    where: { id: locationId },
    data: {
      name: normalized.name,
      province: normalized.province,
      ...(payload.address !== undefined && { address: normalized.address }),
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
  LOCATION_PROVINCE_RULES,
  createLocation,
  deactivateLocation,
  getLocationById,
  getLocations,
  normalizeLocationPayload,
  updateLocation,
}
