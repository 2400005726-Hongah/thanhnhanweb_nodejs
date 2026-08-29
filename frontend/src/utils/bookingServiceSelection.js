const STORAGE_PREFIX = 'thanhnhan.booking.service-selection.'

const SERVICE_MODE_LABELS = {
  TaiVanPhong: 'Tại văn phòng nhà xe',
  DonTaiBenXe: 'Đón trực tiếp tại bến xe trung tâm',
  DonTaiDiemHen: 'Đón tại điểm hẹn',
  TrungChuyenDonKhach: 'Xe trung chuyển đón khách',
  TraTaiBenXe: 'Trả khách tại bến xe trung tâm đích đến',
  TraTaiVanPhong: 'Trả khách tại văn phòng nhà xe',
  TraTaiDiemDung: 'Trả khách tại điểm dừng',
  TrungChuyenTraKhach: 'Xe trung chuyển trả tận nơi khu vực nội thành',
}

const emptyServiceSelection = () => ({
  pickupKind: 'DiemChinh',
  pickupServicePointId: '',
  pickupRequestedAddress: '',
  dropoffKind: 'DiemChinh',
  dropoffServicePointId: '',
  dropoffRequestedAddress: '',
})

const storageKey = (tripId) => `${STORAGE_PREFIX}${tripId}`

const normalizeSelection = (selection = {}) => ({
  ...emptyServiceSelection(),
  ...selection,
  pickupServicePointId: selection.pickupServicePointId || '',
  pickupRequestedAddress: String(selection.pickupRequestedAddress || '').trim(),
  dropoffServicePointId: selection.dropoffServicePointId || '',
  dropoffRequestedAddress: String(selection.dropoffRequestedAddress || '').trim(),
})

const getBookingServiceSelection = (tripId) => {
  if (!tripId || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(tripId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return normalizeSelection(parsed?.selection || parsed)
  } catch {
    return null
  }
}

const saveBookingServiceSelection = (tripId, selection) => {
  if (!tripId || typeof window === 'undefined') return
  window.sessionStorage.setItem(
    storageKey(tripId),
    JSON.stringify({
      selection: normalizeSelection(selection),
      savedAt: new Date().toISOString(),
    }),
  )
}

const clearBookingServiceSelection = (tripId) => {
  if (!tripId || typeof window === 'undefined') return
  window.sessionStorage.removeItem(storageKey(tripId))
}

const getDefaultPoint = (points) =>
  points.find((point) => point.kind === 'DiemChinh' || point.isDefault) || points[0] || null

const getPointById = (points, id) =>
  points.find((point) => point.id && point.id === id) || null


const formatServiceClock = (value) => {
  if (!value) return null
  const raw = String(value)
  const match = raw.match(/(?:T|^)(\d{2}:\d{2})/)
  return match?.[1] || raw.slice(0, 5) || null
}

const pointSummary = (point, fallbackMode = null) => ({
  title: point?.location?.name || 'Chưa xác định',
  detail: point?.location?.address || 'Chưa có địa chỉ chi tiết',
  serviceMode: point?.serviceMode || fallbackMode,
  serviceLabel:
    SERVICE_MODE_LABELS[point?.serviceMode || fallbackMode] ||
    'Chưa xác định hình thức',
  time: formatServiceClock(point?.estimatedTime || point?.estimatedDateTime),
})

const transferSummary = (address, serviceMode) => ({
  title: address || 'Chưa nhập địa chỉ',
  detail: 'Địa chỉ do khách cung cấp cho xe trung chuyển.',
  serviceMode,
  serviceLabel: SERVICE_MODE_LABELS[serviceMode],
  time: null,
})

const getSelectedServiceSummary = (serviceData, selection) => {
  const normalized = normalizeSelection(selection)
  const pickupPoints = serviceData?.pickupPoints ?? []
  const dropoffPoints = serviceData?.dropoffPoints ?? []
  const trip = serviceData?.trip || {}

  let pickup
  if (normalized.pickupKind === 'TrungChuyen') {
    pickup = transferSummary(
      normalized.pickupRequestedAddress,
      'TrungChuyenDonKhach',
    )
  } else if (normalized.pickupKind === 'DiemHen') {
    pickup = pointSummary(getPointById(pickupPoints, normalized.pickupServicePointId))
  } else {
    pickup = pointSummary(getDefaultPoint(pickupPoints), trip.primaryPickupMode)
  }

  let dropoff
  if (normalized.dropoffKind === 'TrungChuyen') {
    dropoff = transferSummary(
      normalized.dropoffRequestedAddress,
      'TrungChuyenTraKhach',
    )
  } else if (normalized.dropoffKind === 'DiemDung') {
    dropoff = pointSummary(getPointById(dropoffPoints, normalized.dropoffServicePointId))
  } else {
    dropoff = pointSummary(getDefaultPoint(dropoffPoints), trip.primaryDropoffMode)
  }

  return { pickup, dropoff }
}

export {
  clearBookingServiceSelection,
  emptyServiceSelection,
  getBookingServiceSelection,
  getSelectedServiceSummary,
  saveBookingServiceSelection,
}
