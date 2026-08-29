const LOCATION_TYPES = Object.freeze({
  PICKUP: 'PICKUP',
  DROPOFF: 'DROPOFF',
  BOTH: 'BOTH',
})

const SERVICE_POINT_TYPES = Object.freeze({
  PICKUP: 'PICKUP',
  DROPOFF: 'DROPOFF',
})

const PICKUP_SERVICE_MODES = Object.freeze({
  OFFICE: 'TaiVanPhong',
  BUS_STATION: 'DonTaiBenXe',
  MEETING_POINT: 'DonTaiDiemHen',
  TRANSFER: 'TrungChuyenDonKhach',
})

const DROPOFF_SERVICE_MODES = Object.freeze({
  BUS_STATION: 'TraTaiBenXe',
  OFFICE: 'TraTaiVanPhong',
  STOP: 'TraTaiDiemDung',
  TRANSFER: 'TrungChuyenTraKhach',
})

const PICKUP_KINDS = Object.freeze({
  PRIMARY: 'DiemChinh',
  TRANSFER: 'TrungChuyen',
  MEETING_POINT: 'DiemHen',
})

const DROPOFF_KINDS = Object.freeze({
  PRIMARY: 'DiemChinh',
  TRANSFER: 'TrungChuyen',
  STOP: 'DiemDung',
})

const SERVICE_MODE_LABELS = Object.freeze({
  [PICKUP_SERVICE_MODES.OFFICE]: 'Tại văn phòng nhà xe',
  [PICKUP_SERVICE_MODES.BUS_STATION]: 'Đón trực tiếp tại bến xe trung tâm',
  [PICKUP_SERVICE_MODES.MEETING_POINT]: 'Đón khách tại điểm hẹn',
  [PICKUP_SERVICE_MODES.TRANSFER]: 'Xe trung chuyển đón khách',
  [DROPOFF_SERVICE_MODES.BUS_STATION]: 'Trả khách tại bến xe trung tâm đích đến',
  [DROPOFF_SERVICE_MODES.OFFICE]: 'Trả khách tại văn phòng nhà xe',
  [DROPOFF_SERVICE_MODES.STOP]: 'Trả khách tại điểm dừng',
  [DROPOFF_SERVICE_MODES.TRANSFER]: 'Xe trung chuyển trả tận nơi khu vực nội thành',
})

const PICKUP_KIND_LABELS = Object.freeze({
  [PICKUP_KINDS.PRIMARY]: 'Điểm đón chính của chuyến',
  [PICKUP_KINDS.TRANSFER]: 'Xe trung chuyển đón khách',
  [PICKUP_KINDS.MEETING_POINT]: 'Đón khách tại điểm hẹn',
})

const DROPOFF_KIND_LABELS = Object.freeze({
  [DROPOFF_KINDS.PRIMARY]: 'Điểm trả chính của chuyến',
  [DROPOFF_KINDS.TRANSFER]: 'Xe trung chuyển trả tận nơi khu vực nội thành',
  [DROPOFF_KINDS.STOP]: 'Trả khách tại điểm dừng',
})

const isPickupServiceMode = (value) =>
  Object.values(PICKUP_SERVICE_MODES).includes(value)

const isDropoffServiceMode = (value) =>
  Object.values(DROPOFF_SERVICE_MODES).includes(value)

const normalizePrimaryPickupMode = (value) =>
  [PICKUP_SERVICE_MODES.OFFICE, PICKUP_SERVICE_MODES.BUS_STATION].includes(value)
    ? value
    : PICKUP_SERVICE_MODES.BUS_STATION

const normalizePrimaryDropoffMode = (value) =>
  [DROPOFF_SERVICE_MODES.BUS_STATION, DROPOFF_SERVICE_MODES.OFFICE].includes(value)
    ? value
    : DROPOFF_SERVICE_MODES.BUS_STATION

const normalizeServiceMode = (pointType, value) => {
  if (pointType === SERVICE_POINT_TYPES.DROPOFF) {
    return isDropoffServiceMode(value) ? value : DROPOFF_SERVICE_MODES.STOP
  }
  return isPickupServiceMode(value) ? value : PICKUP_SERVICE_MODES.MEETING_POINT
}

const getServiceModeLabel = (value) =>
  SERVICE_MODE_LABELS[value] || 'Chưa xác định'

const getPickupKindLabel = (value) =>
  PICKUP_KIND_LABELS[value] || PICKUP_KIND_LABELS[PICKUP_KINDS.PRIMARY]

const getDropoffKindLabel = (value) =>
  DROPOFF_KIND_LABELS[value] || DROPOFF_KIND_LABELS[DROPOFF_KINDS.PRIMARY]

export {
  DROPOFF_KIND_LABELS,
  DROPOFF_KINDS,
  DROPOFF_SERVICE_MODES,
  LOCATION_TYPES,
  PICKUP_KIND_LABELS,
  PICKUP_KINDS,
  PICKUP_SERVICE_MODES,
  SERVICE_MODE_LABELS,
  SERVICE_POINT_TYPES,
  getDropoffKindLabel,
  getPickupKindLabel,
  getServiceModeLabel,
  isDropoffServiceMode,
  isPickupServiceMode,
  normalizePrimaryDropoffMode,
  normalizePrimaryPickupMode,
  normalizeServiceMode,
}
