const isExpiredHold = (seat, now = new Date()) =>
  seat.status === 'HELD' &&
  seat.holdExpiresAt instanceof Date &&
  seat.holdExpiresAt <= now

const isSeatAvailable = (seat, now = new Date()) =>
  seat.status === 'AVAILABLE' || isExpiredHold(seat, now)

const buildAvailableSeatWhere = (now = new Date()) => ({
  OR: [
    { status: 'AVAILABLE' },
    { status: 'HELD', holdExpiresAt: { lte: now } },
  ],
})

const summarizeTripSeats = (seats, now = new Date()) =>
  seats.reduce(
    (summary, seat) => {
      summary.total += 1
      if (isSeatAvailable(seat, now)) {
        summary.available += 1
      } else if (seat.status === 'HELD') {
        summary.held += 1
      } else if (seat.status === 'BOOKED') {
        summary.booked += 1
      }
      return summary
    },
    { total: 0, available: 0, held: 0, booked: 0 },
  )

export {
  buildAvailableSeatWhere,
  isExpiredHold,
  isSeatAvailable,
  summarizeTripSeats,
}
