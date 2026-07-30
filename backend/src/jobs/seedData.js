import { pathToFileURL } from 'node:url'

import { connectDatabase, disconnectDatabase } from '../config/database.js'
import prisma from '../config/prisma.js'
import { buildFutureVietnamDate } from '../utils/dateTime.js'
import { normalizeLicensePlate } from '../utils/normalize.js'

const DEFAULT_SCHEDULE_DAYS = 30
const TRIP_SEAT_BATCH_SIZE = 750
const DAY_MS = 24 * 60 * 60 * 1000

const locationData = [
  {
    name: 'Krông Năng',
    province: 'Đắk Lắk',
    address: 'Thị trấn Krông Năng, huyện Krông Năng',
  },
  {
    name: 'Buôn Hồ',
    province: 'Đắk Lắk',
    address: 'Thành phố Buôn Hồ, tỉnh Đắk Lắk',
  },
  {
    name: 'Buôn Ma Thuột',
    province: 'Đắk Lắk',
    address: 'Bến xe phía Nam Buôn Ma Thuột',
  },
  {
    name: 'Thành phố Hồ Chí Minh',
    province: 'Thành phố Hồ Chí Minh',
    address: 'Bến xe Miền Đông mới',
  },
  {
    name: 'Đà Lạt',
    province: 'Lâm Đồng',
    address: 'Bến xe liên tỉnh Đà Lạt',
  },
  {
    name: 'Nha Trang',
    province: 'Khánh Hòa',
    address: 'Bến xe phía Nam Nha Trang',
  },
]

const routeData = [
  {
    key: 'KRONG_NANG_HCM',
    routeName: 'Krông Năng → Thành phố Hồ Chí Minh',
    departure: 'Krông Năng',
    arrival: 'Thành phố Hồ Chí Minh',
    distanceKm: 380,
    durationMinutes: 480,
  },
  {
    key: 'HCM_KRONG_NANG',
    routeName: 'Thành phố Hồ Chí Minh → Krông Năng',
    departure: 'Thành phố Hồ Chí Minh',
    arrival: 'Krông Năng',
    distanceKm: 380,
    durationMinutes: 480,
  },
  {
    key: 'BUON_HO_HCM',
    routeName: 'Buôn Hồ → Thành phố Hồ Chí Minh',
    departure: 'Buôn Hồ',
    arrival: 'Thành phố Hồ Chí Minh',
    distanceKm: 350,
    durationMinutes: 450,
  },
  {
    key: 'HCM_BUON_HO',
    routeName: 'Thành phố Hồ Chí Minh → Buôn Hồ',
    departure: 'Thành phố Hồ Chí Minh',
    arrival: 'Buôn Hồ',
    distanceKm: 350,
    durationMinutes: 450,
  },
  {
    key: 'BUON_MA_THUOT_HCM',
    routeName: 'Buôn Ma Thuột → Thành phố Hồ Chí Minh',
    departure: 'Buôn Ma Thuột',
    arrival: 'Thành phố Hồ Chí Minh',
    distanceKm: 330,
    durationMinutes: 420,
  },
  {
    key: 'HCM_BUON_MA_THUOT',
    routeName: 'Thành phố Hồ Chí Minh → Buôn Ma Thuột',
    departure: 'Thành phố Hồ Chí Minh',
    arrival: 'Buôn Ma Thuột',
    distanceKm: 330,
    durationMinutes: 420,
  },
  {
    key: 'BUON_MA_THUOT_DA_LAT',
    routeName: 'Buôn Ma Thuột → Đà Lạt',
    departure: 'Buôn Ma Thuột',
    arrival: 'Đà Lạt',
    distanceKm: 210,
    durationMinutes: 300,
  },
  {
    key: 'DA_LAT_BUON_MA_THUOT',
    routeName: 'Đà Lạt → Buôn Ma Thuột',
    departure: 'Đà Lạt',
    arrival: 'Buôn Ma Thuột',
    distanceKm: 210,
    durationMinutes: 300,
  },
  {
    key: 'BUON_MA_THUOT_NHA_TRANG',
    routeName: 'Buôn Ma Thuột → Nha Trang',
    departure: 'Buôn Ma Thuột',
    arrival: 'Nha Trang',
    distanceKm: 185,
    durationMinutes: 240,
  },
  {
    key: 'NHA_TRANG_BUON_MA_THUOT',
    routeName: 'Nha Trang → Buôn Ma Thuột',
    departure: 'Nha Trang',
    arrival: 'Buôn Ma Thuột',
    distanceKm: 185,
    durationMinutes: 240,
  },
]

const buildSeats = ({ countPerFloor, prefixes, seatType }) =>
  prefixes.flatMap((prefix, floorIndex) =>
    Array.from({ length: countPerFloor }, (_, index) => ({
      seatCode: `${prefix}${String(index + 1).padStart(2, '0')}`,
      floor: floorIndex + 1,
      seatType,
      status: 'ACTIVE',
    })),
  )

const sleeperSeats = () =>
  buildSeats({
    countPerFloor: 22,
    prefixes: ['A', 'B'],
    seatType: 'NORMAL',
  })

const limousineSeats = () =>
  buildSeats({
    countPerFloor: 11,
    prefixes: ['L', 'U'],
    seatType: 'VIP',
  })

const busData = [
  {
    busName: 'Xe giường nằm 44 giường',
    licensePlate: '47B-04444',
    busType: 'SLEEPER',
    capacity: 44,
    seats: sleeperSeats(),
  },
  {
    busName: 'Xe limousine 22 phòng',
    licensePlate: '47B-02222',
    busType: 'LIMOUSINE',
    capacity: 22,
    seats: limousineSeats(),
  },
  {
    busName: 'Giường nằm Thành Nhân 01',
    licensePlate: '47B-10001',
    busType: 'SLEEPER',
    capacity: 44,
    seats: sleeperSeats(),
  },
  {
    busName: 'Limousine Thành Nhân 02',
    licensePlate: '47B-10002',
    busType: 'LIMOUSINE',
    capacity: 22,
    seats: limousineSeats(),
  },
  {
    busName: 'Giường nằm Thành Nhân 03',
    licensePlate: '47B-20001',
    busType: 'SLEEPER',
    capacity: 44,
    seats: sleeperSeats(),
  },
  {
    busName: 'Giường nằm Thành Nhân 04',
    licensePlate: '47B-30001',
    busType: 'SLEEPER',
    capacity: 44,
    seats: sleeperSeats(),
  },
  {
    busName: 'Limousine Thành Nhân 05',
    licensePlate: '47B-40001',
    busType: 'LIMOUSINE',
    capacity: 22,
    seats: limousineSeats(),
  },
  {
    busName: 'Limousine Thành Nhân 06',
    licensePlate: '47B-50001',
    busType: 'LIMOUSINE',
    capacity: 22,
    seats: limousineSeats(),
  },
]

const recurringServices = [
  {
    busPlate: '47B10001',
    departures: [
      { routeKey: 'BUON_HO_HCM', hour: 6, minute: 0, price: 320000 },
      { routeKey: 'HCM_BUON_HO', hour: 15, minute: 30, price: 320000 },
    ],
  },
  {
    busPlate: '47B10002',
    departures: [
      { routeKey: 'HCM_BUON_HO', hour: 5, minute: 0, price: 380000 },
      { routeKey: 'BUON_HO_HCM', hour: 19, minute: 0, price: 380000 },
    ],
  },
  {
    busPlate: '47B20001',
    departures: [
      { routeKey: 'KRONG_NANG_HCM', hour: 6, minute: 0, price: 330000 },
      { routeKey: 'HCM_KRONG_NANG', hour: 17, minute: 0, price: 330000 },
    ],
  },
  {
    busPlate: '47B30001',
    departures: [
      { routeKey: 'BUON_MA_THUOT_HCM', hour: 6, minute: 30, price: 310000 },
      { routeKey: 'HCM_BUON_MA_THUOT', hour: 16, minute: 0, price: 310000 },
    ],
  },
  {
    busPlate: '47B40001',
    departures: [
      { routeKey: 'BUON_MA_THUOT_DA_LAT', hour: 7, minute: 0, price: 220000 },
      { routeKey: 'DA_LAT_BUON_MA_THUOT', hour: 14, minute: 0, price: 220000 },
    ],
  },
  {
    busPlate: '47B50001',
    departures: [
      { routeKey: 'BUON_MA_THUOT_NHA_TRANG', hour: 6, minute: 0, price: 200000 },
      { routeKey: 'NHA_TRANG_BUON_MA_THUOT', hour: 13, minute: 0, price: 200000 },
    ],
  },
]

const routeByKey = new Map(routeData.map((route) => [route.key, route]))

const buildScheduleTemplates = (days = DEFAULT_SCHEDULE_DAYS) => {
  const templates = []

  for (let dayOffset = 1; dayOffset <= days; dayOffset += 1) {
    for (const service of recurringServices) {
      for (const departure of service.departures) {
        const route = routeByKey.get(departure.routeKey)
        const departureTime = buildFutureVietnamDate(
          dayOffset,
          departure.hour,
          departure.minute,
        )
        templates.push({
          ...departure,
          busPlate: service.busPlate,
          dayOffset,
          departureTime,
          expectedArrivalTime: new Date(
            departureTime.getTime() + route.durationMinutes * 60 * 1000,
          ),
        })
      }
    }
  }

  return templates
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const hasOverlap = (left, right) =>
  left.departureTime < right.expectedArrivalTime &&
  left.expectedArrivalTime > right.departureTime

const upsertMasterData = () =>
  prisma.$transaction(
    async (transaction) => {
      const locations = {}
      const routes = {}
      const buses = {}

      for (const data of locationData) {
        const existingLocation = await transaction.location.findFirst({
          where: {
            name: { equals: data.name, mode: 'insensitive' },
            province: { equals: data.province, mode: 'insensitive' },
          },
          select: { id: true },
        })
        const location = existingLocation
          ? await transaction.location.update({
              where: { id: existingLocation.id },
              data: {
                name: data.name,
                province: data.province,
                address: data.address,
                status: 'ACTIVE',
              },
            })
          : await transaction.location.create({
              data: { ...data, status: 'ACTIVE' },
            })
        locations[data.name] = location
      }

      for (const data of routeData) {
        const departureLocationId = locations[data.departure].id
        const arrivalLocationId = locations[data.arrival].id
        const existingRoute = await transaction.route.findFirst({
          where: {
            departureLocationId,
            arrivalLocationId,
          },
          select: { id: true },
        })
        const route = existingRoute
          ? await transaction.route.update({
              where: { id: existingRoute.id },
              data: {
                routeName: data.routeName,
                distanceKm: data.distanceKm,
                estimatedDurationMinutes: data.durationMinutes,
                status: 'ACTIVE',
              },
            })
          : await transaction.route.create({
              data: {
                routeName: data.routeName,
                departureLocationId,
                arrivalLocationId,
                distanceKm: data.distanceKm,
                estimatedDurationMinutes: data.durationMinutes,
                status: 'ACTIVE',
              },
            })
        routes[data.key] = route
      }

      const existingBuses = await transaction.bus.findMany({
        select: { id: true, licensePlate: true },
      })

      for (const data of busData) {
        const licensePlate = normalizeLicensePlate(data.licensePlate)
        const existingBus = existingBuses.find(
          (item) => normalizeLicensePlate(item.licensePlate) === licensePlate,
        )
        const bus = existingBus
          ? await transaction.bus.update({
              where: { id: existingBus.id },
              data: {
                busName: data.busName,
                busType: data.busType,
                capacity: data.capacity,
                status: 'ACTIVE',
              },
            })
          : await transaction.bus.create({
              data: {
                busName: data.busName,
                licensePlate,
                busType: data.busType,
                capacity: data.capacity,
                status: 'ACTIVE',
              },
            })
        buses[licensePlate] = bus

        await transaction.seat.createMany({
          data: data.seats.map((seat) => ({ ...seat, busId: bus.id })),
          skipDuplicates: true,
        })
      }

      return { routes, buses }
    },
    { maxWait: 10000, timeout: 60000 },
  )

const seedFutureSchedules = ({ routes, buses }, days) => {
  const templates = buildScheduleTemplates(days)
  const scheduleBusIds = recurringServices.map(
    (service) => buses[service.busPlate].id,
  )
  const firstDeparture = templates[0].departureTime
  const lastArrival = templates.at(-1).expectedArrivalTime

  return prisma.$transaction(
    async (transaction) => {
      const existingTrips = await transaction.trip.findMany({
        where: {
          busId: { in: scheduleBusIds },
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
          ticketPrice: true,
          status: true,
        },
      })
      const occupiedTrips = existingTrips.filter(
        (trip) => trip.status !== 'CANCELLED',
      )
      const managedTrips = []
      const tripsToCreate = []
      let skippedConflicts = 0

      for (const template of templates) {
        const route = routes[template.routeKey]
        const bus = buses[template.busPlate]
        const exactTrip = existingTrips.find(
          (trip) =>
            trip.busId === bus.id &&
            trip.routeId === route.id &&
            trip.departureTime.getTime() === template.departureTime.getTime(),
        )

        if (exactTrip) {
          managedTrips.push(exactTrip)
          continue
        }

        const candidate = {
          routeId: route.id,
          busId: bus.id,
          departureTime: template.departureTime,
          expectedArrivalTime: template.expectedArrivalTime,
          ticketPrice: template.price,
          status: 'OPEN',
          createdById: null,
        }
        const conflict = occupiedTrips.some(
          (trip) => trip.busId === candidate.busId && hasOverlap(trip, candidate),
        )

        if (conflict) {
          skippedConflicts += 1
          continue
        }

        tripsToCreate.push(candidate)
        occupiedTrips.push(candidate)
      }

      const createdTrips = tripsToCreate.length
        ? await transaction.trip.createManyAndReturn({
            data: tripsToCreate,
            select: {
              id: true,
              routeId: true,
              busId: true,
              departureTime: true,
              expectedArrivalTime: true,
              ticketPrice: true,
              status: true,
            },
          })
        : []
      const tripsForSeats = [...managedTrips, ...createdTrips]
      const activeSeats = await transaction.seat.findMany({
        where: { busId: { in: scheduleBusIds }, status: 'ACTIVE' },
        select: {
          id: true,
          busId: true,
          seatCode: true,
          floor: true,
          seatType: true,
        },
      })
      const seatsByBus = activeSeats.reduce((groupedSeats, seat) => {
        const busSeats = groupedSeats.get(seat.busId) || []
        busSeats.push(seat)
        groupedSeats.set(seat.busId, busSeats)
        return groupedSeats
      }, new Map())
      const tripSeatData = tripsForSeats.flatMap((trip) =>
        (seatsByBus.get(trip.busId) || []).map((seat) => ({
          tripId: trip.id,
          seatId: seat.id,
          seatCode: seat.seatCode,
          floor: seat.floor,
          seatType: seat.seatType,
          price: trip.ticketPrice,
          status: 'AVAILABLE',
        })),
      )

      for (const batch of chunk(tripSeatData, TRIP_SEAT_BATCH_SIZE)) {
        await transaction.tripSeat.createMany({
          data: batch,
          skipDuplicates: true,
        })
      }

      return {
        createdTrips: createdTrips.length,
        reusedTrips: managedTrips.length,
        skippedConflicts,
        coveredDays: days,
      }
    },
    { maxWait: 10000, timeout: 120000 },
  )
}

const seedData = async ({ scheduleDays = DEFAULT_SCHEDULE_DAYS } = {}) => {
  const masterData = await upsertMasterData()
  const summary = await seedFutureSchedules(masterData, scheduleDays)

  console.log(
    `Đã seed ${locationData.length} địa điểm, ${routeData.length} tuyến, ${busData.length} xe và lịch ${summary.coveredDays} ngày ` +
      `(tạo ${summary.createdTrips} chuyến, dùng lại ${summary.reusedTrips} chuyến, bỏ qua ${summary.skippedConflicts} lịch trùng)`,
  )

  return summary
}

const run = async () => {
  try {
    await connectDatabase()
    await seedData()
  } catch (error) {
    console.error(`Không thể seed dữ liệu mẫu: ${error.message}`)
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
}

export {
  DEFAULT_SCHEDULE_DAYS,
  buildScheduleTemplates,
  busData,
  locationData,
  recurringServices,
  routeData,
  seedData,
}
