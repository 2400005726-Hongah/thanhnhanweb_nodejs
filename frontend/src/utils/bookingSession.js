const HOLD_KEY_PREFIX = 'thanh-nhan:seat-hold:'
const SHARED_HOLD_KEY_PREFIX = 'thanh-nhan:shared-seat-hold:'
const HOLD_TOKEN_KEY_PREFIX = 'thanh-nhan:seat-hold-token:'
const BOOKING_KEY_PREFIX = 'thanh-nhan:booking:'

const readStorageValue = (storage, key) => {
  if (typeof window === 'undefined' || !storage) return null
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const getHoldSeatIds = (hold) =>
  (hold?.seats || [])
    .map((seat) => seat?.id)
    .filter(Boolean)
    .sort()

const normalizeSeatIds = (seatIds = []) =>
  [...new Set((seatIds || []).filter(Boolean))].sort()

const seatIdsMatch = (left, right) => {
  const a = normalizeSeatIds(left)
  const b = normalizeSeatIds(right)
  return a.length === b.length && a.every((value, index) => value === b[index])
}

const sharedHoldKey = (tripId, seatIds) =>
  `${SHARED_HOLD_KEY_PREFIX}${tripId}:${normalizeSeatIds(seatIds).join(',')}`


const holdTokenKey = (tripId, seatIds) =>
  `${HOLD_TOKEN_KEY_PREFIX}${tripId}:${normalizeSeatIds(seatIds).join(',')}`

const createHoldToken = () => {
  if (typeof window === 'undefined') return ''
  const bytes = new Uint8Array(32)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

const getOrCreateSeatHoldToken = (tripId, seatIds = []) => {
  if (typeof window === 'undefined') return ''

  const key = holdTokenKey(tripId, seatIds)
  const existing = window.localStorage.getItem(key)
  if (/^[a-f0-9]{64}$/i.test(existing || '')) return existing

  const token = createHoldToken()
  window.localStorage.setItem(key, token)
  return token
}

const saveSeatHold = (tripId, hold) => {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    `${HOLD_KEY_PREFIX}${tripId}`,
    JSON.stringify(hold),
  )

  const seatIds = getHoldSeatIds(hold)
  if (seatIds.length) {
    window.localStorage.setItem(
      sharedHoldKey(tripId, seatIds),
      JSON.stringify(hold),
    )
  }
}

const getSeatHold = (tripId, expectedSeatIds = null) => {
  if (typeof window === 'undefined') return null

  const ownHold = readStorageValue(
    window.sessionStorage,
    `${HOLD_KEY_PREFIX}${tripId}`,
  )

  if (!expectedSeatIds) return ownHold

  if (ownHold && seatIdsMatch(getHoldSeatIds(ownHold), expectedSeatIds)) {
    return ownHold
  }

  const sharedHold = readStorageValue(
    window.localStorage,
    sharedHoldKey(tripId, expectedSeatIds),
  )

  if (sharedHold && seatIdsMatch(getHoldSeatIds(sharedHold), expectedSeatIds)) {
    // Đồng bộ vào session của tab hiện tại để các thao tác quay lại/hủy
    // có thể giải phóng đúng hold đang được dùng.
    window.sessionStorage.setItem(
      `${HOLD_KEY_PREFIX}${tripId}`,
      JSON.stringify(sharedHold),
    )
    return sharedHold
  }

  return null
}

const clearSeatHold = (tripId, expectedSeatIds = null) => {
  if (typeof window === 'undefined') return

  const ownHold = readStorageValue(
    window.sessionStorage,
    `${HOLD_KEY_PREFIX}${tripId}`,
  )
  const ownSeatIds = getHoldSeatIds(ownHold)
  const seatIds = expectedSeatIds?.length ? expectedSeatIds : ownSeatIds

  window.sessionStorage.removeItem(`${HOLD_KEY_PREFIX}${tripId}`)

  if (seatIds?.length) {
    window.localStorage.removeItem(sharedHoldKey(tripId, seatIds))
    window.localStorage.removeItem(holdTokenKey(tripId, seatIds))
  }
}

const saveBookingResult = (booking) => {
  window.sessionStorage.setItem(
    `${BOOKING_KEY_PREFIX}${booking.bookingCode}`,
    JSON.stringify(booking),
  )
}

const getBookingResult = (bookingCode) =>
  readStorageValue(window.sessionStorage, `${BOOKING_KEY_PREFIX}${bookingCode}`)

export {
  clearSeatHold,
  getBookingResult,
  getOrCreateSeatHoldToken,
  getSeatHold,
  saveBookingResult,
  saveSeatHold,
}
