import prisma from '../config/prisma.js'
import {
  getBusCapacity,
  getBusSeatTemplate,
  isManagedBusType,
} from '../config/busCatalog.js'
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

const ensureLegacySeatStructure = async (busId) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    select: { id: true, busType: true },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  if (isManagedBusType(bus.busType)) {
    throw new HttpError(
      'Sơ đồ xe 34 giường và 22 phòng được quản lý từ mẫu tập trung',
      409,
    )
  }

  return bus
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
      include: {
        seats: { orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }] },
      },
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
    include: {
      seats: { orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }] },
    },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  return bus
}

const createBus = async (payload) => {
  if (!isManagedBusType(payload.busType)) {
    throw new HttpError(
      'Xe mới chỉ hỗ trợ loại SLEEPER_34 hoặc LIMOUSINE_22',
      400,
    )
  }

  const capacity = getBusCapacity(payload.busType)
  if (
    payload.capacity !== undefined &&
    Number(payload.capacity) !== capacity
  ) {
    throw new HttpError(
      `Sức chứa của ${payload.busType} phải là ${capacity}`,
      400,
    )
  }
  if (
    payload.seats !== undefined &&
    (!Array.isArray(payload.seats) || payload.seats.length > 0)
  ) {
    throw new HttpError('Sơ đồ ghế phải do máy chủ tạo từ mẫu chuẩn', 400)
  }

  const licensePlate = normalizeLicensePlate(payload.licensePlate)
  const seats = getBusSeatTemplate(payload.busType)

  return prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.bus.findUnique({
      where: { licensePlate },
      select: { id: true },
    })
    if (duplicate) {
      throw new HttpError('Biển số xe đã tồn tại', 409)
    }

    const bus = await transaction.bus.create({
      data: {
        busName: normalizeText(payload.busName),
        licensePlate,
        busType: payload.busType,
        capacity,
        status: payload.status || 'ACTIVE',
      },
    })

    await transaction.seat.createMany({
      data: seats.map((seat) => ({ ...seat, busId: bus.id })),
    })

    return transaction.bus.findUnique({
      where: { id: bus.id },
      include: {
        seats: { orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }] },
      },
    })
  })
}

const updateBus = async (busId, payload) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: { _count: { select: { seats: true, trips: true } } },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  if (payload.busType !== undefined && payload.busType !== bus.busType) {
    throw new HttpError(
      'Không thể đổi loại xe; hãy tạo xe mới để giữ nguyên sơ đồ và lịch sử',
      409,
    )
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

  if (payload.capacity !== undefined) {
    if (
      isManagedBusType(bus.busType) &&
      Number(payload.capacity) !== getBusCapacity(bus.busType)
    ) {
      throw new HttpError(
        `Sức chứa của ${bus.busType} phải là ${getBusCapacity(bus.busType)}`,
        400,
      )
    }
    if (payload.capacity < bus._count.seats) {
      throw new HttpError(
        'Sức chứa không được nhỏ hơn số ghế hiện có',
        400,
      )
    }
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
      ...(payload.capacity !== undefined && {
        capacity: Number(payload.capacity),
      }),
      ...(payload.status && { status: payload.status }),
    },
    include: {
      seats: { orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }] },
    },
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
      busType: true,
      capacity: true,
      seats: { orderBy: [{ floor: 'asc' }, { seatCode: 'asc' }] },
    },
  })

  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }

  return {
    busId: bus.id,
    busName: bus.busName,
    busType: bus.busType,
    capacity: bus.capacity,
    seats: bus.seats,
  }
}

const addBusSeat = async (busId, payload) => {
  await ensureLegacySeatStructure(busId)
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
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    select: { id: true, busType: true },
  })
  if (!bus) {
    throw new HttpError('Không tìm thấy xe', 404)
  }
  if (isManagedBusType(bus.busType)) {
    throw new HttpError(
      'Không thể sửa riêng từng vị trí của sơ đồ chuẩn',
      409,
    )
  }
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
  await ensureLegacySeatStructure(busId)
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
