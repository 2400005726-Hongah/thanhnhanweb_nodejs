const SEAT_PREFIX = 'thanhnhan.booking.seat-draft.'
const PASSENGER_PREFIX = 'thanhnhan.booking.passenger-draft.'

const readJson = (key) => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeJson = (key, value) => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(key, JSON.stringify(value))
}

const seatKey = (tripId) => `${SEAT_PREFIX}${tripId}`
const passengerKey = (tripId) => `${PASSENGER_PREFIX}${tripId}`

const getBookingSeatDraft = (tripId) => {
  const value = readJson(seatKey(tripId))
  if (!value || !Array.isArray(value.seats) || value.seats.length === 0) return null
  return {
    seats: value.seats,
    roomSelections: Array.isArray(value.roomSelections) ? value.roomSelections : [],
    totalAmount: Number(value.totalAmount || 0),
    savedAt: value.savedAt || null,
  }
}

const saveBookingSeatDraft = (tripId, { seats, roomSelections = [], totalAmount = 0 }) => {
  if (!tripId || !Array.isArray(seats) || seats.length === 0) return
  writeJson(seatKey(tripId), {
    seats,
    roomSelections,
    totalAmount: Number(totalAmount || 0),
    savedAt: new Date().toISOString(),
  })
}

const clearBookingSeatDraft = (tripId) => {
  if (typeof window === 'undefined' || !tripId) return
  window.sessionStorage.removeItem(seatKey(tripId))
}

const getBookingPassengerDraft = (tripId) => {
  const value = readJson(passengerKey(tripId))
  if (!value) return null
  return {
    passenger: {
      fullName: value.passenger?.fullName || '',
      phone: value.passenger?.phone || '',
      email: value.passenger?.email || '',
    },
    customerNote: value.customerNote || '',
    savedAt: value.savedAt || null,
  }
}

const saveBookingPassengerDraft = (tripId, passenger, customerNote = '') => {
  if (!tripId) return
  writeJson(passengerKey(tripId), {
    passenger: {
      fullName: passenger?.fullName || '',
      phone: passenger?.phone || '',
      email: passenger?.email || '',
    },
    customerNote: customerNote || '',
    savedAt: new Date().toISOString(),
  })
}

const clearBookingPassengerDraft = (tripId) => {
  if (typeof window === 'undefined' || !tripId) return
  window.sessionStorage.removeItem(passengerKey(tripId))
}

const clearBookingFlowDrafts = (tripId) => {
  clearBookingSeatDraft(tripId)
  clearBookingPassengerDraft(tripId)
}

export {
  clearBookingFlowDrafts,
  clearBookingPassengerDraft,
  clearBookingSeatDraft,
  getBookingPassengerDraft,
  getBookingSeatDraft,
  saveBookingPassengerDraft,
  saveBookingSeatDraft,
}
