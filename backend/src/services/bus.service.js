import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { normalizeLicensePlate } from '../utils/normalize.js'
import {
  buildPagination,
  normalizeText,
  parsePagination,
} from '../utils/query.js'

const ensureBusHasNoFutureTrip = async (busId) => {
  const count = await prisma.trip.count({
    where: {
      busId,
      departureTime: { gt: new Date() },
      status: { not: 'CANCELLED' },
    },
  })

  if (count > 0) {
    throw new HttpError('Xe đang được sử dụng bởi chuyến tương lai', 409)
  }
}

const ensureSeatStructureMutable = async (busId) => {
  const protectedSeatCount = await prisma.tripSeat.count({
    where: {
      status: { in: ['HELD', 'BOOKED'] },
      trip: {
        busId,
        departureTime: { gt: new Date() },
        status: { not: 'CANCELLED' },
      },
    },
  })

  if (protectedSeatCount > 0) {
    throw new HttpError(
      'Không thể sửa ghế khi chuyến tương lai có ghế đang giữ hoặc đã đặt',
      409,
    )
  }
}

const getBuses = async (query) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.busType && { busType: query.busType }),
  }

  if (query.keyword) {
    where.OR = ['busName', 'licensePlate'].map((field) => ({
      [field]: { contains: query.keyword.trim(), mode: 'insensitive' },
    }))
  }

  const [buses, total] = await Promise.all([
    prisma.bus.findMany({
      where,
      include: { seats: { orderBy: { seatCode: 'asc' } } },
      orderBy: { busName: 'asc' },
      skip,
      take: limit,
    }),
    prisma.bus.count({ where }),
  ])

  return { buses, pagination: buildPagination(total, page, limit) }
}

const getBusById = async (busId) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: { seats: { orderBy: { seatCode: 'asc' } } },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  return bus
}

const createBus = async (payload) => {
  const licensePlate = normalizeLicensePlate(payload.licensePlate)
  const duplicate = await prisma.bus.findUnique({
    where: { licensePlate },
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Biển số xe đã tồn tại', 409)
  }

  const seats = payload.seats || []
  if (seats.length > payload.capacity) {
    throw new HttpError('Số ghế không được vượt quá sức chứa', 400)
  }

  return prisma.bus.create({
    data: {
      busName: normalizeText(payload.busName),
      licensePlate,
      busType: payload.busType,
      capacity: payload.capacity,
      status: payload.status || 'ACTIVE',
      seats: {
        create: seats.map((seat) => ({
          seatCode: String(seat.seatCode).trim().toUpperCase(),
          floor: seat.floor,
          seatType: seat.seatType || 'NORMAL',
          status: seat.status || 'ACTIVE',
        })),
      },
    },
    include: { seats: { orderBy: { seatCode: 'asc' } } },
  })
}

const updateBus = async (busId, payload) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: { _count: { select: { seats: true } } },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }

  let licensePlate = bus.licensePlate
  if (payload.licensePlate !== undefined) {
    licensePlate = normalizeLicensePlate(payload.licensePlate)
    const duplicate = await prisma.bus.findFirst({
      where: { id: { not: busId }, licensePlate },
      select: { id: true },
    })
    if (duplicate) {
      throw new HttpError('Biển số xe đã tồn tại', 409)
    }
  }

  if (payload.capacity !== undefined && payload.capacity < bus._count.seats) {
    throw new HttpError(
      'Sức chứa không được nhỏ hơn số ghế hiện có',
      400,
    )
  }
  if (
    payload.status &&
    payload.status !== 'ACTIVE' &&
    bus.status === 'ACTIVE'
  ) {
    await ensureBusHasNoFutureTrip(busId)
  }

  return prisma.bus.update({
    where: { id: busId },
    data: {
      licensePlate,
      ...(payload.busName !== undefined && {
        busName: normalizeText(payload.busName),
      }),
      ...(payload.busType !== undefined && { busType: payload.busType }),
      ...(payload.capacity !== undefined && { capacity: payload.capacity }),
      ...(payload.status && { status: payload.status }),
    },
    include: { seats: { orderBy: { seatCode: 'asc' } } },
  })
}

const deactivateBus = async (busId) => {
  const bus = await prisma.bus.findUnique({ where: { id: busId } })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  if (bus.status === 'INACTIVE') {
    return bus
  }

  await ensureBusHasNoFutureTrip(busId)
  return prisma.bus.update({
    where: { id: busId },
    data: { status: 'INACTIVE' },
  })
}

const getBusSeats = async (busId) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    select: {
      id: true,
      busName: true,
      capacity: true,
      seats: { orderBy: { seatCode: 'asc' } },
    },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }

  return {
    busId: bus.id,
    busName: bus.busName,
    capacity: bus.capacity,
    seats: bus.seats,
  }
}

const addBusSeat = async (busId, payload) => {
  await ensureSeatStructureMutable(busId)
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: { _count: { select: { seats: true } } },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  if (bus._count.seats >= bus.capacity) {
    throw new HttpError('Số ghế không được vượt quá sức chứa', 400)
  }

  const seatCode = String(payload.seatCode).trim().toUpperCase()
  const duplicate = await prisma.seat.findUnique({
    where: { busId_seatCode: { busId, seatCode } },
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Mã ghế đã tồn tại trong xe', 409)
  }

  return prisma.seat.create({
    data: {
      busId,
      seatCode,
      floor: payload.floor,
      seatType: payload.seatType || 'NORMAL',
      status: payload.status || 'ACTIVE',
    },
  })
}

const updateBusSeat = async (busId, seatId, payload) => {
  await ensureSeatStructureMutable(busId)
  const seat = await prisma.seat.findFirst({ where: { id: seatId, busId } })

  if (!seat) {
    throw new HttpError('Không tìm thấy ghế', 404)
  }

  let seatCode = seat.seatCode
  if (payload.seatCode !== undefined) {
    seatCode = String(payload.seatCode).trim().toUpperCase()
    const duplicate = await prisma.seat.findFirst({
      where: { busId, seatCode, id: { not: seatId } },
      select: { id: true },
    })
    if (duplicate) {
      throw new HttpError('Mã ghế đã tồn tại trong xe', 409)
    }
  }

  return prisma.seat.update({
    where: { id: seatId },
    data: {
      seatCode,
      ...(payload.floor !== undefined && { floor: payload.floor }),
      ...(payload.seatType !== undefined && { seatType: payload.seatType }),
      ...(payload.status !== undefined && { status: payload.status }),
    },
  })
}

const deactivateBusSeat = async (busId, seatId) => {
  await ensureSeatStructureMutable(busId)
  const seat = await prisma.seat.findFirst({ where: { id: seatId, busId } })

  if (!seat) {
    throw new HttpError('Không tìm thấy ghế', 404)
  }
  if (seat.status === 'INACTIVE') {
    return seat
  }

  return prisma.seat.update({
    where: { id: seatId },
    data: { status: 'INACTIVE' },
  })
}

export {
  addBusSeat,
  createBus,
  deactivateBus,
  deactivateBusSeat,
  getBusById,
  getBuses,
  getBusSeats,
  updateBus,
  updateBusSeat,
}
