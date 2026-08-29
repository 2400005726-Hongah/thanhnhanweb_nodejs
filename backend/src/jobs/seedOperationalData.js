import { pathToFileURL } from 'node:url'

import {
  getBusCapacity,
  getBusSeatTemplate,
} from '../config/busCatalog.js'
import {
  OPERATIONAL_SCHEDULE_DAYS,
  busData,
  locationData,
  newsData,
  routeData,
  scheduleData,
} from '../config/operationalSeedData.js'
import {
  connectDatabase,
  disconnectDatabase,
} from '../config/database.js'
import prisma from '../config/prisma.js'
import { buildFutureVietnamDate } from '../utils/dateTime.js'
import { normalizeLicensePlate } from '../utils/normalize.js'

const TRIP_SEAT_BATCH_SIZE = 600
const DAY_MS = 24 * 60 * 60 * 1000

const normalizeLookup = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')

const canonicalNameAliases = new Map([
  ['tphcm', 'TP.HCM'],
  ['thanhphohochiminh', 'TP.HCM'],
  ['hochiminh', 'TP.HCM'],
  ['saigon', 'TP.HCM'],
  ['krongnang', 'Krông Năng'],
  ['thitran krongnang'.replace(/\s/g, ''), 'Krông Năng'],
  ['buonmathuot', 'Buôn Ma Thuột'],
  ['binhduong', 'Bình Dương'],
])

const canonicalProvinceAliases = new Map([
  ['tphcm', 'TP.HCM'],
  ['thanhphohochiminh', 'TP.HCM'],
  ['hochiminh', 'TP.HCM'],
  ['daklak', 'Đắk Lắk'],
  ['binhduong', 'Bình Dương'],
])

const canonicalizeLocationName = (value) => {
  const normalized = normalizeLookup(value)
  return canonicalNameAliases.get(normalized) || normalizeText(value)
}

const canonicalizeProvince = (value) => {
  const normalized = normalizeLookup(value)
  return canonicalProvinceAliases.get(normalized) || normalizeText(value)
}

const chunk = (items, size) => {
  const batches = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

const hasOverlap = (left, right) =>
  left.departureTime < right.expectedArrivalTime &&
  left.expectedArrivalTime > right.departureTime

const getSeatPrice = (trip, seatType) => {
  if (trip.busType === 'SLEEPER_34') {
    return trip.ticketPrice
  }
  return seatType === 'DOUBLE_ROOM'
    ? trip.doubleRoomPrice
    : trip.singleRoomPrice
}

const upsertLocations = async (transaction) => {
  const existingLocations = await transaction.location.findMany()
  const result = {}

  for (const rawData of locationData) {
    const data = {
      ...rawData,
      name: canonicalizeLocationName(rawData.name),
      province: canonicalizeProvince(rawData.province),
      address: normalizeText(rawData.address) || null,
    }

    const province = await transaction.province.upsert({
      where: { name: data.province },
      update: { status: 'ACTIVE' },
      create: { name: data.province, status: 'ACTIVE' },
    })

    const defaultArea = await transaction.pickupDropoffArea.upsert({
      where: {
        provinceId_name: {
          provinceId: province.id,
          name: data.name,
        },
      },
      update: {
        legacyRegion: data.province,
        detailedAddress: data.address,
        status: 'ACTIVE',
      },
      create: {
        provinceId: province.id,
        legacyRegion: data.province,
        name: data.name,
        detailedAddress: data.address,
        status: 'ACTIVE',
      },
    })

    const lookupKey = `${normalizeLookup(data.name)}|${normalizeLookup(data.province)}`
    const existing = existingLocations.find(
      (item) =>
        `${normalizeLookup(item.name)}|${normalizeLookup(item.province)}` ===
        lookupKey,
    )

    const locationPayload = {
      name: data.name,
      normalizedName: normalizeLookup(data.name),
      province: data.province,
      provinceId: province.id,
      defaultAreaId: defaultArea.id,
      address: data.address,
      locationType: 'BOTH',
      status: 'ACTIVE',
    }

    const location = existing
      ? await transaction.location.update({
          where: { id: existing.id },
          data: locationPayload,
        })
      : await transaction.location.create({ data: locationPayload })

    await transaction.locationAreaFilter.upsert({
      where: {
        locationId_areaId: {
          locationId: location.id,
          areaId: defaultArea.id,
        },
      },
      update: {},
      create: {
        locationId: location.id,
        areaId: defaultArea.id,
      },
    })

    result[rawData.key] = location
  }

  return result
}

const upsertRoutes = async (transaction, locations) => {
  const result = {}

  for (const data of routeData) {
    const departure = locations[data.departureKey]
    const arrival = locations[data.arrivalKey]

    if (!departure || !arrival || departure.id === arrival.id) {
      throw new Error(`Dữ liệu tuyến ${data.key} không hợp lệ`)
    }

    const routeName = `${departure.name} → ${arrival.name}`
    const existing = await transaction.route.findUnique({
      where: {
        departureLocationId_arrivalLocationId: {
          departureLocationId: departure.id,
          arrivalLocationId: arrival.id,
        },
      },
    })

    const routePayload = {
      routeName,
      distanceKm: Number(data.distanceKm),
      estimatedDurationMinutes: Number(data.estimatedDurationMinutes),
      defaultTicketPrice: Number(data.defaultTicketPrice),
      defaultSingleRoomPrice: Number(data.defaultSingleRoomPrice),
      defaultDoubleRoomPrice: Number(data.defaultDoubleRoomPrice),
      status: 'ACTIVE',
    }

    result[data.key] = existing
      ? await transaction.route.update({
          where: { id: existing.id },
          data: routePayload,
        })
      : await transaction.route.create({
          data: {
            ...routePayload,
            departureLocationId: departure.id,
            arrivalLocationId: arrival.id,
          },
        })
  }

  return result
}

const ensureManagedSeatStructure = async (transaction, bus, data) => {
  const expectedSeats = getBusSeatTemplate(data.busType)
  const existingSeats = await transaction.seat.findMany({
    where: { busId: bus.id },
    orderBy: { seatCode: 'asc' },
  })

  if (existingSeats.length === 0) {
    await transaction.seat.createMany({
      data: expectedSeats.map((seat) => ({ ...seat, busId: bus.id })),
    })
    return
  }

  const expectedByCode = new Map(
    expectedSeats.map((seat) => [seat.seatCode, seat]),
  )
  const structureMatches =
    existingSeats.length === expectedSeats.length &&
    existingSeats.every((seat) => {
      const expected = expectedByCode.get(seat.seatCode)
      return (
        expected &&
        expected.floor === seat.floor &&
        expected.seatType === seat.seatType
      )
    })

  if (!structureMatches) {
    throw new Error(
      `Xe ${bus.licensePlate} đã có sơ đồ ghế không đúng mẫu ${data.busType}. ` +
        'Không tự động xóa ghế để tránh làm hỏng dữ liệu lịch sử.',
    )
  }

  await transaction.seat.updateMany({
    where: { busId: bus.id },
    data: { status: 'ACTIVE' },
  })
}

const upsertBuses = async (transaction) => {
  const existingBuses = await transaction.bus.findMany()
  const result = {}

  for (const data of busData) {
    const licensePlate = normalizeLicensePlate(data.licensePlate)
    const capacity = getBusCapacity(data.busType)

    if (!capacity) {
      throw new Error(`Loại xe ${data.busType} chưa có mẫu ghế chuẩn`)
    }

    const existing = existingBuses.find(
      (item) => normalizeLicensePlate(item.licensePlate) === licensePlate,
    )
    const payload = {
      busName: normalizeText(data.busName),
      licensePlate,
      busType: data.busType,
      capacity,
      status: data.status || 'ACTIVE',
    }

    const bus = existing
      ? await transaction.bus.update({
          where: { id: existing.id },
          data: payload,
        })
      : await transaction.bus.create({ data: payload })

    await ensureManagedSeatStructure(transaction, bus, data)
    result[data.key] = bus
  }

  return result
}

const upsertMasterData = () =>
  prisma.$transaction(
    async (transaction) => {
      const locations = await upsertLocations(transaction)
      const routes = await upsertRoutes(transaction, locations)
      const buses = await upsertBuses(transaction)
      return { locations, routes, buses }
    },
    { maxWait: 10000, timeout: 120000 },
  )

const buildScheduleTemplates = (
  masterData,
  days = OPERATIONAL_SCHEDULE_DAYS,
) => {
  const templates = []

  for (let dayOffset = 1; dayOffset <= days; dayOffset += 1) {
    for (const schedule of scheduleData) {
      const routeKey =
        dayOffset % 2 === 1 ? schedule.oddRouteKey : schedule.evenRouteKey
      const routeConfig = routeData.find((item) => item.key === routeKey)
      const route = masterData.routes[routeKey]
      const bus = masterData.buses[schedule.busKey]
      const departureTime = buildFutureVietnamDate(
        dayOffset,
        schedule.hour,
        schedule.minute,
      )

      if (!routeConfig || !route || !bus) {
        throw new Error(`Thiếu cấu hình lịch cho ${schedule.busKey}/${routeKey}`)
      }

      const isSleeper = bus.busType === 'SLEEPER_34'
      templates.push({
        routeId: route.id,
        busId: bus.id,
        busType: bus.busType,
        departureTime,
        expectedArrivalTime: new Date(
          departureTime.getTime() +
            routeConfig.estimatedDurationMinutes * 60 * 1000,
        ),
        ticketPrice: isSleeper ? routeConfig.defaultTicketPrice : null,
        singleRoomPrice: isSleeper
          ? null
          : routeConfig.defaultSingleRoomPrice,
        doubleRoomPrice: isSleeper
          ? null
          : routeConfig.defaultDoubleRoomPrice,
        status: 'OPEN',
        departureLocationId: route.departureLocationId,
        arrivalLocationId: route.arrivalLocationId,
        salesStatus: 'OPEN',
        operationStatus: 'NOT_DEPARTED',
      })
    }
  }

  return templates
}

const seedFutureTrips = async (
  masterData,
  days = OPERATIONAL_SCHEDULE_DAYS,
) => {
  const templates = buildScheduleTemplates(masterData, days)
  const busIds = Object.values(masterData.buses).map((bus) => bus.id)
  const firstDeparture = templates[0].departureTime
  const lastArrival = templates.at(-1).expectedArrivalTime
  const actor = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return prisma.$transaction(
    async (transaction) => {
      const existingTrips = await transaction.trip.findMany({
        where: {
          busId: { in: busIds },
          departureTime: {
            gte: new Date(firstDeparture.getTime() - DAY_MS),
            lte: new Date(lastArrival.getTime() + DAY_MS),
          },
        },
        select: {
          id: true,
          routeId: true,
          busId: true,
          departureTime: true,
          expectedArrivalTime: true,
          status: true,
          ticketPrice: true,
          singleRoomPrice: true,
          doubleRoomPrice: true,
        },
      })
      const occupiedTrips = existingTrips.filter(
        (trip) => trip.status !== 'CANCELLED',
      )
      const reusedTrips = []
      const toCreate = []
      let skippedConflicts = 0

      for (const candidate of templates) {
        const exact = existingTrips.find(
          (trip) =>
            trip.busId === candidate.busId &&
            trip.routeId === candidate.routeId &&
            trip.departureTime.getTime() === candidate.departureTime.getTime(),
        )

        if (exact) {
          reusedTrips.push({ ...exact, busType: candidate.busType })
          continue
        }

        const conflict = occupiedTrips.some(
          (trip) => trip.busId === candidate.busId && hasOverlap(trip, candidate),
        )
        if (conflict) {
          skippedConflicts += 1
          continue
        }

        toCreate.push({
          routeId: candidate.routeId,
          busId: candidate.busId,
          departureTime: candidate.departureTime,
          expectedArrivalTime: candidate.expectedArrivalTime,
          ticketPrice: candidate.ticketPrice,
          singleRoomPrice: candidate.singleRoomPrice,
          doubleRoomPrice: candidate.doubleRoomPrice,
          status: candidate.status,
          departureLocationId: candidate.departureLocationId,
          arrivalLocationId: candidate.arrivalLocationId,
          salesStatus: candidate.salesStatus,
          operationStatus: candidate.operationStatus,
          createdById: actor?.id ?? null,
        })
        occupiedTrips.push(candidate)
      }

      const createdTrips = toCreate.length
        ? await transaction.trip.createManyAndReturn({
            data: toCreate,
            select: {
              id: true,
              routeId: true,
              busId: true,
              departureTime: true,
              expectedArrivalTime: true,
              ticketPrice: true,
              singleRoomPrice: true,
              doubleRoomPrice: true,
              status: true,
              departureLocationId: true,
              arrivalLocationId: true,
              salesStatus: true,
              operationStatus: true,
            },
          })
        : []

      const busesById = new Map(
        Object.values(masterData.buses).map((bus) => [bus.id, bus]),
      )
      const trips = [...reusedTrips, ...createdTrips].map((trip) => ({
        ...trip,
        busType: trip.busType || busesById.get(trip.busId)?.busType,
      }))
      const activeSeats = await transaction.seat.findMany({
        where: { busId: { in: busIds }, status: 'ACTIVE' },
        select: {
          id: true,
          busId: true,
          seatCode: true,
          floor: true,
          seatType: true,
        },
      })
      const seatsByBus = activeSeats.reduce((map, seat) => {
        const seats = map.get(seat.busId) || []
        seats.push(seat)
        map.set(seat.busId, seats)
        return map
      }, new Map())
      const tripSeatRows = trips.flatMap((trip) =>
        (seatsByBus.get(trip.busId) || []).map((seat) => ({
          tripId: trip.id,
          seatId: seat.id,
          seatCode: seat.seatCode,
          floor: seat.floor,
          seatType: seat.seatType,
          price: getSeatPrice(trip, seat.seatType),
          status: 'AVAILABLE',
        })),
      )

      for (const batch of chunk(tripSeatRows, TRIP_SEAT_BATCH_SIZE)) {
        await transaction.tripSeat.createMany({
          data: batch,
          skipDuplicates: true,
        })
      }

      return {
        createdTrips: createdTrips.length,
        reusedTrips: reusedTrips.length,
        skippedConflicts,
        coveredDays: days,
      }
    },
    { maxWait: 10000, timeout: 180000 },
  )
}

const seedNews = async () => {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!admin) {
    console.warn('Không có tài khoản Chủ xe hoạt động; bỏ qua dữ liệu tin tức.')
    return 0
  }

  let count = 0
  for (const item of newsData) {
    await prisma.news.upsert({
      where: { slug: item.slug },
      update: {
        title: normalizeText(item.title),
        summary: normalizeText(item.summary),
        content: item.content,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedById: admin.id,
      },
      create: {
        title: normalizeText(item.title),
        slug: item.slug,
        summary: normalizeText(item.summary),
        content: item.content,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: admin.id,
        updatedById: admin.id,
      },
    })
    count += 1
  }
  return count
}

const seedOperationalData = async ({
  scheduleDays = OPERATIONAL_SCHEDULE_DAYS,
} = {}) => {
  const userCountBefore = await prisma.user.count()
  const masterData = await upsertMasterData()
  const tripSummary = await seedFutureTrips(masterData, scheduleDays)
  const newsCount = await seedNews()
  const userCountAfter = await prisma.user.count()

  if (userCountAfter !== userCountBefore) {
    throw new Error('Seed dữ liệu vận hành không được phép thay đổi bảng tài khoản')
  }

  const summary = {
    usersPreserved: userCountAfter,
    locations: Object.keys(masterData.locations).length,
    routes: Object.keys(masterData.routes).length,
    buses: Object.keys(masterData.buses).length,
    news: newsCount,
    ...tripSummary,
  }

  console.log(
    'Đã tạo dữ liệu vận hành chuẩn hóa: ' +
      `${summary.locations} địa điểm, ${summary.routes} tuyến, ` +
      `${summary.buses} xe, ${summary.createdTrips} chuyến mới, ` +
      `${summary.reusedTrips} chuyến dùng lại, ${summary.news} tin tức.`,
  )
  console.log(`Đã giữ nguyên ${summary.usersPreserved} tài khoản hiện có.`)
  return summary
}

const run = async () => {
  try {
    await connectDatabase()
    await seedOperationalData()
  } catch (error) {
    console.error(`Không thể tạo dữ liệu vận hành: ${error.message}`)
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
}

export {
  buildScheduleTemplates,
  canonicalizeLocationName,
  canonicalizeProvince,
  normalizeLookup,
  seedOperationalData,
}
