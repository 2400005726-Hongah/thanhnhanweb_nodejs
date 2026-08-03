import env from '../config/env.js'
import prisma from '../config/prisma.js'
import { writeAuditLog } from '../services/auditLog.service.js'

const TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable',
  maxWait: 5000,
  timeout: 15000,
}

let cleanupTimer = null
let cleanupPromise = null

const lockBooking = (database, bookingId) =>
  database.$queryRaw`
    SELECT id
    FROM bookings
    WHERE id = ${bookingId}::uuid
    FOR UPDATE
  `

const lockTripSeats = async (database, tripSeatIds) => {
  for (const tripSeatId of [...tripSeatIds].sort()) {
    await database.$queryRaw`
      SELECT id
      FROM trip_seats
      WHERE id = ${tripSeatId}::uuid
      FOR UPDATE
    `
  }
}

const expireBooking = async (bookingId, now = new Date(), database = prisma) =>
  database.$transaction(async (transaction) => {
    await lockBooking(transaction, bookingId)
    const booking = await transaction.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        source: true,
        status: true,
        paymentStatus: true,
        expiresAt: true,
      },
    })

    if (
      !booking ||
      booking.source !== 'ONLINE' ||
      booking.status !== 'PENDING' ||
      booking.paymentStatus !== 'PENDING' ||
      !booking.expiresAt ||
      booking.expiresAt > now
    ) {
      return { expired: false, releasedSeatCount: 0 }
    }

    const items = await transaction.bookingItem.findMany({
      where: { bookingId },
      select: { tripSeatId: true },
      orderBy: { tripSeatId: 'asc' },
    })
    const tripSeatIds = [...new Set(items.map((item) => item.tripSeatId))]
    await lockTripSeats(transaction, tripSeatIds)

    const expired = await transaction.booking.updateMany({
      where: {
        id: bookingId,
        source: 'ONLINE',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    })
    if (expired.count !== 1) {
      return { expired: false, releasedSeatCount: 0 }
    }

    const released =
      tripSeatIds.length === 0
        ? { count: 0 }
        : await transaction.tripSeat.updateMany({
            where: {
              id: { in: tripSeatIds },
              status: 'BOOKED',
              bookingItems: {
                none: {
                  bookingId: { not: bookingId },
                  booking: { status: { in: ['PENDING', 'CONFIRMED'] } },
                },
              },
            },
            data: { status: 'AVAILABLE', heldBy: null, holdExpiresAt: null },
          })

    await writeAuditLog(
      {
        userId: null,
        role: null,
        action: 'EXPIRE_BOOKING',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: 'Booking Online hết thời hạn thanh toán',
        metadata: {
          source: 'ONLINE',
          releasedSeatCount: released.count,
          expiredAt: now.toISOString(),
        },
      },
      transaction,
    )

    return { expired: true, releasedSeatCount: released.count }
  }, TRANSACTION_OPTIONS)

const cleanupExpiredBookings = async ({
  now = new Date(),
  batchSize = env.bookingCleanupBatchSize,
  database = prisma,
} = {}) => {
  const candidates = await database.booking.findMany({
    where: {
      source: 'ONLINE',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      expiresAt: { lte: now },
    },
    select: { id: true },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
  })

  const summary = {
    candidateCount: candidates.length,
    expiredBookingCount: 0,
    releasedSeatCount: 0,
    errorCount: 0,
  }

  for (const candidate of candidates) {
    try {
      const result = await expireBooking(candidate.id, now, database)
      if (result.expired) summary.expiredBookingCount += 1
      summary.releasedSeatCount += result.releasedSeatCount
    } catch (error) {
      summary.errorCount += 1
      console.error(
        `Không thể cleanup booking ${candidate.id}: ${error.code || error.name || 'UNKNOWN_ERROR'}`,
      )
    }
  }

  return summary
}

const runBookingCleanupCycle = async () => {
  if (cleanupPromise) return cleanupPromise

  cleanupPromise = (async () => {
    const summary = await cleanupExpiredBookings()
    if (summary.candidateCount > 0 || summary.errorCount > 0) {
      console.log(
        `Cleanup booking: hết hạn ${summary.expiredBookingCount}, giải phóng ${summary.releasedSeatCount} ghế, lỗi ${summary.errorCount}`,
      )
    }
    return summary
  })().finally(() => {
    cleanupPromise = null
  })

  return cleanupPromise
}

const startBookingCleanupJob = () => {
  if (cleanupTimer) return cleanupTimer

  void runBookingCleanupCycle().catch((error) => {
    console.error(
      `Cleanup booking không thể chạy: ${error.code || error.name || 'UNKNOWN_ERROR'}`,
    )
  })
  cleanupTimer = setInterval(() => {
    void runBookingCleanupCycle().catch((error) => {
      console.error(
        `Cleanup booking không thể chạy: ${error.code || error.name || 'UNKNOWN_ERROR'}`,
      )
    })
  }, env.bookingCleanupIntervalMinutes * 60 * 1000)
  cleanupTimer.unref?.()
  return cleanupTimer
}

const stopBookingCleanupJob = async () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
  if (cleanupPromise) {
    await cleanupPromise.catch(() => null)
  }
}

export {
  cleanupExpiredBookings,
  expireBooking,
  runBookingCleanupCycle,
  startBookingCleanupJob,
  stopBookingCleanupJob,
}
