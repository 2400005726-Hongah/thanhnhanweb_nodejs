import prisma from '../config/prisma.js'
import { hasPermission, PERMISSIONS } from '../config/permissions.js'
import HttpError from '../utils/HttpError.js'
import {
  normalizeAddress,
  normalizeComparisonKey,
  normalizeLocationName,
  normalizeProvince,
  normalizeWhitespace,
} from '../utils/normalize.js'
import { writeAuditLog } from './auditLog.service.js'

const normalizeStatus = (value, fallback = 'ACTIVE') =>
  ['ACTIVE', 'INACTIVE'].includes(value) ? value : fallback

const ensureAuthorizedCatalogWrite = (actor) => {
  if (!actor || !hasPermission(actor.role, PERMISSIONS.EDIT_ROUTES)) {
    throw new HttpError('Bạn không có quyền quản lý danh mục địa điểm', 403)
  }
}

const ensureProvince = async (database, provinceId) => {
  const province = await database.province.findUnique({ where: { id: provinceId } })
  if (!province) throw new HttpError('Không tìm thấy tỉnh/thành', 404)
  return province
}

const ensureArea = async (database, areaId) => {
  const area = await database.pickupDropoffArea.findUnique({
    where: { id: areaId },
    include: { province: true },
  })
  if (!area || area.isDeleted) throw new HttpError('Không tìm thấy khu vực/bộ lọc địa điểm', 404)
  return area
}

const findNormalizedProvinceDuplicate = async (database, name, excludeId = null) => {
  const all = await database.province.findMany({ select: { id: true, name: true } })
  const key = normalizeComparisonKey(name)
  return all.find(
    (item) => item.id !== excludeId && normalizeComparisonKey(item.name) === key,
  )
}

const findNormalizedAreaDuplicate = async (
  database,
  { provinceId, name, excludeId = null },
) => {
  const all = await database.pickupDropoffArea.findMany({
    where: { provinceId },
    select: { id: true, name: true },
  })
  const key = normalizeComparisonKey(name)
  return all.find(
    (item) => item.id !== excludeId && normalizeComparisonKey(item.name) === key,
  )
}

const getLocationCatalog = async ({ includeInactive = false } = {}) => {
  const activeStatus = includeInactive ? {} : { status: 'ACTIVE' }
  const [provinces, areas, locations] = await Promise.all([
    prisma.province.findMany({
      where: activeStatus,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
    prisma.pickupDropoffArea.findMany({
      where: { isDeleted: false, ...activeStatus },
      include: { province: true },
      orderBy: [{ province: { name: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.location.findMany({
      where: { isDeleted: false, ...activeStatus },
      include: {
        provinceRef: true,
        defaultArea: true,
        areaFilters: { include: { area: true } },
      },
      orderBy: [{ province: 'asc' }, { name: 'asc' }],
    }),
  ])

  return { provinces, areas, locations }
}

const listProvinces = async ({ includeInactive = false } = {}) =>
  prisma.province.findMany({
    where: includeInactive ? {} : { status: 'ACTIVE' },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  })

const createProvince = async (payload, actor) => {
  ensureAuthorizedCatalogWrite(actor)
  const name = normalizeProvince(payload.name)
  if (!name) throw new HttpError('Tên tỉnh/thành là bắt buộc', 400)

  return prisma.$transaction(async (transaction) => {
    if (await findNormalizedProvinceDuplicate(transaction, name)) {
      throw new HttpError('Tỉnh/thành này đã tồn tại', 409)
    }

    const province = await transaction.province.create({
      data: { name, status: normalizeStatus(payload.status) },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'CREATE_PROVINCE',
        entityType: 'PROVINCE',
        entityId: province.id,
        description: `Thêm tỉnh/thành ${province.name}`,
      },
      transaction,
    )

    return province
  })
}

const updateProvince = async (provinceId, payload, actor) => {
  ensureAuthorizedCatalogWrite(actor)

  return prisma.$transaction(async (transaction) => {
    const province = await ensureProvince(transaction, provinceId)
    const name = payload.name !== undefined ? normalizeProvince(payload.name) : province.name

    if (!name) throw new HttpError('Tên tỉnh/thành là bắt buộc', 400)
    if (await findNormalizedProvinceDuplicate(transaction, name, provinceId)) {
      throw new HttpError('Tỉnh/thành này đã tồn tại', 409)
    }

    if (payload.status === 'INACTIVE') {
      const [activeLocationCount, activeAreaCount] = await Promise.all([
        transaction.location.count({
          where: { provinceId, isDeleted: false, status: 'ACTIVE' },
        }),
        transaction.pickupDropoffArea.count({
          where: { provinceId, isDeleted: false, status: 'ACTIVE' },
        }),
      ])
      if (activeLocationCount > 0 || activeAreaCount > 0) {
        throw new HttpError(
          'Không thể ngừng tỉnh/thành khi vẫn còn khu vực hoặc địa điểm đang hoạt động',
          409,
        )
      }
    }

    const updated = await transaction.province.update({
      where: { id: provinceId },
      data: {
        name,
        ...(payload.status && { status: payload.status }),
      },
    })

    if (name !== province.name) {
      await transaction.location.updateMany({
        where: { provinceId },
        data: { province: name },
      })
    }

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'UPDATE_PROVINCE',
        entityType: 'PROVINCE',
        entityId: provinceId,
        description: `Cập nhật tỉnh/thành ${updated.name}`,
        metadata: { previousName: province.name, status: updated.status },
      },
      transaction,
    )

    return updated
  })
}

const listAreas = async ({ provinceId, includeInactive = false } = {}) =>
  prisma.pickupDropoffArea.findMany({
    where: {
      isDeleted: false,
      ...(provinceId && { provinceId }),
      ...(!includeInactive && { status: 'ACTIVE' }),
    },
    include: { province: true },
    orderBy: [{ province: { name: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
  })

const createArea = async (payload, actor) => {
  ensureAuthorizedCatalogWrite(actor)
  const name = normalizeWhitespace(payload.name)
  if (!name) throw new HttpError('Tên khu vực/bộ lọc là bắt buộc', 400)

  return prisma.$transaction(async (transaction) => {
    const province = await ensureProvince(transaction, payload.provinceId)
    if (province.status !== 'ACTIVE' && normalizeStatus(payload.status) === 'ACTIVE') {
      throw new HttpError('Không thể tạo bộ lọc hoạt động trong tỉnh/thành đã ngừng', 409)
    }
    if (
      await findNormalizedAreaDuplicate(transaction, {
        provinceId: province.id,
        name,
      })
    ) {
      throw new HttpError('Khu vực/bộ lọc này đã tồn tại trong tỉnh/thành', 409)
    }

    const area = await transaction.pickupDropoffArea.create({
      data: {
        provinceId: province.id,
        legacyRegion: normalizeWhitespace(payload.legacyRegion) || province.name,
        name,
        detailedAddress: normalizeAddress(payload.detailedAddress),
        sortOrder: Number(payload.sortOrder || 0),
        status: normalizeStatus(payload.status),
      },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'CREATE_LOCATION_AREA',
        entityType: 'PICKUP_DROPOFF_AREA',
        entityId: area.id,
        description: `Thêm khu vực ${area.name} - ${province.name}`,
      },
      transaction,
    )

    return area
  })
}

const updateArea = async (areaId, payload, actor) => {
  ensureAuthorizedCatalogWrite(actor)

  return prisma.$transaction(async (transaction) => {
    const area = await ensureArea(transaction, areaId)
    const nextProvinceId = payload.provinceId || area.provinceId
    const province = await ensureProvince(transaction, nextProvinceId)
    const nextStatus = payload.status || area.status
    if (province.status !== 'ACTIVE' && nextStatus === 'ACTIVE') {
      throw new HttpError('Không thể kích hoạt bộ lọc trong tỉnh/thành đã ngừng', 409)
    }
    const name = payload.name !== undefined ? normalizeWhitespace(payload.name) : area.name

    if (
      await findNormalizedAreaDuplicate(transaction, {
        provinceId: nextProvinceId,
        name,
        excludeId: areaId,
      })
    ) {
      throw new HttpError('Khu vực/bộ lọc này đã tồn tại trong tỉnh/thành', 409)
    }

    const updated = await transaction.pickupDropoffArea.update({
      where: { id: areaId },
      data: {
        provinceId: nextProvinceId,
        name,
        ...(payload.legacyRegion !== undefined && {
          legacyRegion: normalizeWhitespace(payload.legacyRegion) || province.name,
        }),
        ...(payload.detailedAddress !== undefined && {
          detailedAddress: normalizeAddress(payload.detailedAddress),
        }),
        ...(payload.sortOrder !== undefined && { sortOrder: Number(payload.sortOrder) }),
        ...(payload.status && { status: payload.status }),
      },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'UPDATE_LOCATION_AREA',
        entityType: 'PICKUP_DROPOFF_AREA',
        entityId: areaId,
        description: `Cập nhật khu vực ${updated.name}`,
      },
      transaction,
    )

    return updated
  })
}

const ensureAreaBelongsToProvince = async (database, provinceId, areaId) => {
  const area = await ensureArea(database, areaId)
  if (area.provinceId !== provinceId) {
    throw new HttpError('Bộ lọc địa điểm không thuộc tỉnh/thành đã chọn', 400)
  }
  return area
}

const ensureFilterAreasBelongToProvince = async (database, provinceId, areaIds = []) => {
  const uniqueIds = [...new Set(areaIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    throw new HttpError('Địa điểm cụ thể phải có ít nhất một bộ lọc áp dụng', 400)
  }

  const areas = await database.pickupDropoffArea.findMany({
    where: {
      id: { in: uniqueIds },
      provinceId,
      isDeleted: false,
    },
  })

  if (areas.length !== uniqueIds.length) {
    throw new HttpError('Một hoặc nhiều bộ lọc áp dụng không thuộc tỉnh/thành đã chọn', 400)
  }

  return areas
}

const listSpecificLocations = async ({
  provinceId,
  usageType,
  includeInactive = false,
} = {}) => {
  const usageFilter = usageType === 'PICKUP'
    ? { locationType: { in: ['PICKUP', 'BOTH'] } }
    : usageType === 'DROPOFF'
      ? { locationType: { in: ['DROPOFF', 'BOTH'] } }
      : usageType === 'BOTH'
        ? { locationType: 'BOTH' }
        : {}

  return prisma.location.findMany({
    where: {
      isDeleted: false,
      ...(provinceId && { provinceId }),
      ...usageFilter,
      ...(!includeInactive && { status: 'ACTIVE' }),
    },
    include: {
      provinceRef: true,
      defaultArea: true,
      areaFilters: { include: { area: true } },
    },
    orderBy: [
      { province: 'asc' },
      { defaultArea: { sortOrder: 'asc' } },
      { name: 'asc' },
    ],
  })
}

const createSpecificLocation = async (payload, actor) => {
  ensureAuthorizedCatalogWrite(actor)

  return prisma.$transaction(async (transaction) => {
    const province = await ensureProvince(transaction, payload.provinceId)
    if (province.status !== 'ACTIVE') {
      throw new HttpError('Tỉnh/thành đã ngừng hoạt động', 409)
    }

    const defaultArea = await ensureAreaBelongsToProvince(
      transaction,
      province.id,
      payload.defaultAreaId,
    )
    if (defaultArea.status !== 'ACTIVE') {
      throw new HttpError('Bộ lọc mặc định đã ngừng hoạt động', 409)
    }

    const filterAreaIds = [
      ...new Set([payload.defaultAreaId, ...(payload.filterAreaIds || [])].filter(Boolean)),
    ]
    const filterAreas = await ensureFilterAreasBelongToProvince(
      transaction,
      province.id,
      filterAreaIds,
    )
    if (normalizeStatus(payload.status) === 'ACTIVE' && filterAreas.some((area) => area.status !== 'ACTIVE')) {
      throw new HttpError('Không thể tạo địa điểm hoạt động với bộ lọc đã ngừng', 409)
    }

    const name = normalizeLocationName(payload.name)
    const normalizedName = normalizeComparisonKey(name)
    const duplicate = await transaction.location.findFirst({
      where: { provinceId: province.id, normalizedName },
      select: { id: true, isDeleted: true },
    })
    if (duplicate) {
      throw new HttpError(
        duplicate.isDeleted
          ? 'Địa điểm cụ thể này đã tồn tại trong dữ liệu đã xóa mềm. Không tạo bản ghi trùng; hãy khôi phục hồ sơ cũ nếu cần.'
          : 'Địa điểm cụ thể này đã tồn tại trong tỉnh/thành đã chọn.',
        409,
      )
    }

    const location = await transaction.location.create({
      data: {
        name,
        normalizedName,
        province: province.name,
        provinceId: province.id,
        defaultAreaId: defaultArea.id,
        address: normalizeAddress(payload.address),
        locationType: payload.locationType || 'BOTH',
        sortOrder: 0,
        status: normalizeStatus(payload.status),
        isDeleted: false,
        areaFilters: {
          create: filterAreaIds.map((areaId) => ({ areaId })),
        },
      },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'CREATE_SPECIFIC_LOCATION',
        entityType: 'LOCATION',
        entityId: location.id,
        description: `Thêm địa điểm cụ thể ${location.name} - ${province.name}`,
        metadata: {
          defaultAreaId: defaultArea.id,
          filterAreaIds,
          locationType: location.locationType,
        },
      },
      transaction,
    )

    return transaction.location.findUnique({
      where: { id: location.id },
      include: {
        provinceRef: true,
        defaultArea: true,
        areaFilters: { include: { area: true } },
      },
    })
  })
}

const updateSpecificLocation = async (locationId, payload, actor) => {
  ensureAuthorizedCatalogWrite(actor)

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.location.findUnique({
      where: { id: locationId },
      include: { areaFilters: true },
    })
    if (!existing || existing.isDeleted) {
      throw new HttpError('Không tìm thấy địa điểm cụ thể', 404)
    }

    const nextProvinceId = payload.provinceId || existing.provinceId
    if (!nextProvinceId) {
      throw new HttpError('Địa điểm cụ thể phải thuộc một tỉnh/thành', 400)
    }

    if (payload.provinceId && payload.provinceId !== existing.provinceId) {
      const [tripCount, bookingCount, servicePointCount] = await Promise.all([
        transaction.trip.count({
          where: {
            OR: [
              { departureLocationId: locationId },
              { arrivalLocationId: locationId },
            ],
          },
        }),
        transaction.booking.count({
          where: {
            OR: [
              { pickupLocationId: locationId },
              { dropoffLocationId: locationId },
            ],
          },
        }),
        transaction.tripServicePoint.count({ where: { locationId } }),
      ])

      if (tripCount > 0 || bookingCount > 0 || servicePointCount > 0) {
        throw new HttpError(
          'Không thể đổi tỉnh/thành của địa điểm đã có lịch sử chuyến hoặc vé',
          409,
        )
      }
    }

    if (payload.status === 'INACTIVE' && existing.status !== 'INACTIVE') {
      const [activeMainTripCount, activeServiceTripCount] = await Promise.all([
        transaction.trip.count({
          where: {
            departureTime: { gt: new Date() },
            status: { in: ['OPEN', 'CLOSED'] },
            OR: [
              { departureLocationId: locationId },
              { arrivalLocationId: locationId },
            ],
          },
        }),
        transaction.tripServicePoint.count({
          where: {
            locationId,
            trip: {
              departureTime: { gt: new Date() },
              status: { in: ['OPEN', 'CLOSED'] },
            },
          },
        }),
      ])

      if (activeMainTripCount > 0 || activeServiceTripCount > 0) {
        throw new HttpError(
          'Không thể ngừng địa điểm đang được chuyến xe sắp tới sử dụng',
          409,
        )
      }
    }

    const province = await ensureProvince(transaction, nextProvinceId)
    const nextLocationStatus = payload.status || existing.status
    if (province.status !== 'ACTIVE' && nextLocationStatus === 'ACTIVE') {
      throw new HttpError('Không thể kích hoạt địa điểm trong tỉnh/thành đã ngừng', 409)
    }

    const nextAreaId = payload.defaultAreaId || existing.defaultAreaId
    if (!nextAreaId) {
      throw new HttpError('Địa điểm cụ thể phải có bộ lọc mặc định', 400)
    }
    const defaultArea = await ensureAreaBelongsToProvince(transaction, province.id, nextAreaId)

    const currentFilterAreaIds = existing.areaFilters.map((filter) => filter.areaId)
    const filterAreaIds = [
      ...new Set([
        nextAreaId,
        ...(payload.filterAreaIds !== undefined ? payload.filterAreaIds : currentFilterAreaIds),
      ].filter(Boolean)),
    ]
    const filterAreas = await ensureFilterAreasBelongToProvince(
      transaction,
      province.id,
      filterAreaIds,
    )
    if (
      nextLocationStatus === 'ACTIVE' &&
      (defaultArea.status !== 'ACTIVE' || filterAreas.some((area) => area.status !== 'ACTIVE'))
    ) {
      throw new HttpError('Không thể kích hoạt địa điểm khi một bộ lọc áp dụng đã ngừng', 409)
    }

    const name = payload.name !== undefined
      ? normalizeLocationName(payload.name)
      : existing.name
    const normalizedName = normalizeComparisonKey(name)
    const duplicate = await transaction.location.findFirst({
      where: {
        id: { not: locationId },
        provinceId: province.id,
        normalizedName,
      },
      select: { id: true, isDeleted: true },
    })
    if (duplicate) {
      throw new HttpError(
        'Địa điểm cụ thể này đã tồn tại trong tỉnh/thành đã chọn.',
        409,
      )
    }

    const updated = await transaction.location.update({
      where: { id: locationId },
      data: {
        name,
        normalizedName,
        province: province.name,
        provinceId: province.id,
        defaultAreaId: defaultArea.id,
        ...(payload.address !== undefined && { address: normalizeAddress(payload.address) }),
        ...(payload.locationType && { locationType: payload.locationType }),
        ...(payload.status && { status: payload.status }),
      },
    })

    if (payload.filterAreaIds !== undefined || payload.defaultAreaId !== undefined || payload.provinceId !== undefined) {
      await transaction.locationAreaFilter.deleteMany({ where: { locationId } })
      await transaction.locationAreaFilter.createMany({
        data: filterAreaIds.map((areaId) => ({ locationId, areaId })),
        skipDuplicates: true,
      })
    }

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'UPDATE_SPECIFIC_LOCATION',
        entityType: 'LOCATION',
        entityId: locationId,
        description: `Cập nhật địa điểm cụ thể ${updated.name}`,
        metadata: {
          defaultAreaId: defaultArea.id,
          filterAreaIds,
          locationType: updated.locationType,
        },
      },
      transaction,
    )

    return transaction.location.findUnique({
      where: { id: locationId },
      include: {
        provinceRef: true,
        defaultArea: true,
        areaFilters: { include: { area: true } },
      },
    })
  })
}

const softDeleteArea = async (areaId, actor) => {
  ensureAuthorizedCatalogWrite(actor)

  return prisma.$transaction(async (transaction) => {
    const area = await transaction.pickupDropoffArea.findUnique({
      where: { id: areaId },
      include: { province: true },
    })
    if (!area || area.isDeleted) {
      throw new HttpError('Không tìm thấy bộ lọc địa điểm', 404)
    }

    const usingLocations = await transaction.location.findMany({
      where: {
        isDeleted: false,
        OR: [
          { defaultAreaId: areaId },
          { areaFilters: { some: { areaId } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    if (usingLocations.length > 0) {
      const names = usingLocations.slice(0, 5).map((item) => item.name).join(', ')
      const suffix = usingLocations.length > 5 ? ', ...' : ''
      throw new HttpError(
        `Không thể xóa bộ lọc "${area.name}" vì đang được ${usingLocations.length} địa điểm cụ thể sử dụng: ${names}${suffix}.`,
        409,
      )
    }

    const deleted = await transaction.pickupDropoffArea.update({
      where: { id: areaId },
      data: { isDeleted: true, status: 'INACTIVE' },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'SOFT_DELETE_LOCATION_AREA',
        entityType: 'PICKUP_DROPOFF_AREA',
        entityId: areaId,
        description: `Xóa mềm bộ lọc ${area.name} - ${area.province.name}`,
      },
      transaction,
    )

    return deleted
  })
}

const softDeleteSpecificLocation = async (locationId, actor) => {
  ensureAuthorizedCatalogWrite(actor)

  return prisma.$transaction(async (transaction) => {
    const location = await transaction.location.findUnique({ where: { id: locationId } })
    if (!location || location.isDeleted) {
      throw new HttpError('Không tìm thấy địa điểm cụ thể', 404)
    }

    const now = new Date()
    const [futureMainTrips, futureServiceTrips] = await Promise.all([
      transaction.trip.count({
        where: {
          departureTime: { gt: now },
          status: { in: ['OPEN', 'CLOSED'] },
          OR: [
            { departureLocationId: locationId },
            { arrivalLocationId: locationId },
          ],
        },
      }),
      transaction.tripServicePoint.count({
        where: {
          locationId,
          trip: {
            departureTime: { gt: now },
            status: { in: ['OPEN', 'CLOSED'] },
          },
        },
      }),
    ])

    if (futureMainTrips > 0 || futureServiceTrips > 0) {
      throw new HttpError(
        `Không thể xóa "${location.name}" vì địa điểm đang được sử dụng cho chuyến chưa đến giờ khởi hành. Hãy đổi địa điểm của các chuyến tương lai trước.`,
        409,
      )
    }

    const deleted = await transaction.location.update({
      where: { id: locationId },
      data: { isDeleted: true, status: 'INACTIVE' },
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'SOFT_DELETE_SPECIFIC_LOCATION',
        entityType: 'LOCATION',
        entityId: locationId,
        description: `Xóa mềm địa điểm cụ thể ${location.name}`,
      },
      transaction,
    )

    return deleted
  })
}

export {
  createArea,
  createProvince,
  createSpecificLocation,
  getLocationCatalog,
  listAreas,
  listProvinces,
  listSpecificLocations,
  softDeleteArea,
  softDeleteSpecificLocation,
  updateArea,
  updateProvince,
  updateSpecificLocation,
}
