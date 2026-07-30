const HOLD_KEY_PREFIX = 'thanh-nhan:seat-hold:'
const BOOKING_KEY_PREFIX = 'thanh-nhan:booking:'

const readSessionValue = (key) => {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.sessionStorage.getItem(key))
  } catch {
    return null
  }
}

const saveSeatHold = (tripId, hold) => {
  window.sessionStorage.setItem(
    `${HOLD_KEY_PREFIX}${tripId}`,
    JSON.stringify(hold),
  )
}

const getSeatHold = (tripId) =>
  readSessionValue(`${HOLD_KEY_PREFIX}${tripId}`)

const clearSeatHold = (tripId) => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(`${HOLD_KEY_PREFIX}${tripId}`)
  }
}

const saveBookingResult = (booking) => {
  window.sessionStorage.setItem(
    `${BOOKING_KEY_PREFIX}${booking.bookingCode}`,
    JSON.stringify(booking),
  )
}

const getBookingResult = (bookingCode) =>
  readSessionValue(`${BOOKING_KEY_PREFIX}${bookingCode}`)

export {
  clearSeatHold,
  getBookingResult,
  getSeatHold,
  saveBookingResult,
  saveSeatHold,
}
