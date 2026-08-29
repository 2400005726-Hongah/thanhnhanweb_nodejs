import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { writeAuditLog } from './auditLog.service.js'

const ensureRoute = async (database, routeId) => {
  const route = await database.route.findUnique({
    where: { id: routeId },
    include: {
      departureLocation: true,
      arrivalLocation: true,
    },
  })

  if (!route) throw new HttpError('Không tìm thấy tuyến xe', 404)
  return route
}

const getRouteStopsWithDatabase = async (
  database,
  routeId,
  { includeInactive = false } = {},
) => {
  const route = await ensureRoute(database, routeId)
  const stops = await database.routeStop.findMany({
    where: {
      routeId,
      ...(!includeInactive && { status: 'ACTIVE' }),
    },
    include: {
      area: {
        include: { province: true },
      },
    },
    orderBy: [{ pointType: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return { route, stops }
}

const getRouteStops = async (routeId, options = {}) =>
  getRouteStopsWithDatabase(prisma, routeId, options)

const validateStops = async (database, route, stops) => {
  const areaIds = [...new Set(stops.map((stop) => stop.areaId))]
  const areas = await database.pickupDropoffArea.findMany({
    where: { id: { in: areaIds }, status: 'ACTIVE' },
    include: { province: true },
  })
  const areaById = new Map(areas.map((area) => [area.id, area]))

  if (areas.length !== areaIds.length) {
    throw new HttpError('Có khu vực điểm dừng không tồn tại hoặc đã ngừng hoạt động', 400)
  }

  const uniqueKeys = new Set()
  return stops.map((raw, index) => {
    if (!['PICKUP', 'DROPOFF'].includes(raw.pointType)) {
      throw new HttpError(`Loại điểm dừng thứ ${index + 1} không hợp lệ`, 400)
    }

    const key = `${raw.areaId}:${raw.pointType}`
    if (uniqueKeys.has(key)) {
      throw new HttpError('Một khu vực không thể lặp lại cùng loại đón/trả trên một tuyến', 409)
    }
    uniqueKeys.add(key)

    const area = areaById.get(raw.areaId)
    const expectedProvinceId =
      raw.pointType === 'PICKUP'
        ? route.departureLocation?.provinceId
        : route.arrivalLocation?.provinceId

    if (expectedProvinceId && area.provinceId !== expectedProvinceId) {
      throw new HttpError(
        raw.pointType === 'PICKUP'
          ? 'Khu vực đón phải thuộc tỉnh/thành điểm đi của tuyến'
          : 'Khu vực trả phải thuộc tỉnh/thành điểm đến của tuyến',
        400,
      )
    }

    return {
      areaId: raw.areaId,
      pointType: raw.pointType,
      sortOrder: Number(raw.sortOrder ?? index),
      status: raw.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }
  })
}

const configureRouteStops = async (routeId, payload, actor) =>
  prisma.$transaction(async (transaction) => {
    const route = await ensureRoute(transaction, routeId)
    const stops = await validateStops(transaction, route, payload.stops || [])
    const incomingKeys = new Set(stops.map((stop) => `${stop.areaId}:${stop.pointType}`))

    const existing = await transaction.routeStop.findMany({
      where: { routeId },
      select: { id: true, areaId: true, pointType: true },
    })

    for (const current of existing) {
      if (!incomingKeys.has(`${current.areaId}:${current.pointType}`)) {
        await transaction.routeStop.update({
          where: { id: current.id },
          data: { status: 'INACTIVE' },
        })
      }
    }

    for (const stop of stops) {
      await transaction.routeStop.upsert({
        where: {
          routeId_areaId_pointType: {
            routeId,
            areaId: stop.areaId,
            pointType: stop.pointType,
          },
        },
        update: {
          sortOrder: stop.sortOrder,
          status: stop.status,
        },
        create: {
          routeId,
          ...stop,
        },
      })
    }

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        actorName: actor.fullName,
        action: 'CONFIGURE_ROUTE_STOPS',
        entityType: 'ROUTE',
        entityId: routeId,
        description: 'Cập nhật khu vực đón/trả của tuyến đường',
        metadata: {
          stopCount: stops.length,
          pickupCount: stops.filter((stop) => stop.pointType === 'PICKUP').length,
          dropoffCount: stops.filter((stop) => stop.pointType === 'DROPOFF').length,
        },
      },
      transaction,
    )

    return getRouteStopsWithDatabase(transaction, routeId, { includeInactive: true })
  })

export {
  configureRouteStops,
  getRouteStops,
  getRouteStopsWithDatabase,
  validateStops,
}
