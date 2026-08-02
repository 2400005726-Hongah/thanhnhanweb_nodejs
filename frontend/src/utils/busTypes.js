const BUS_TYPE_LABELS = Object.freeze({
  SLEEPER_34: 'Giường nằm 34 giường',
  LIMOUSINE_22: 'Limousine 22 phòng',
  SLEEPER: 'Giường nằm 44 giường (legacy)',
  LIMOUSINE: 'Limousine legacy',
  SEATED: 'Ghế ngồi legacy',
})

const MANAGED_BUS_CAPACITIES = Object.freeze({
  SLEEPER_34: 34,
  LIMOUSINE_22: 22,
})

const SEAT_TYPE_LABELS = Object.freeze({
  NORMAL: 'Giường nằm',
  VIP: 'VIP legacy',
  SINGLE_ROOM: 'Phòng đơn',
  DOUBLE_ROOM: 'Phòng đôi',
})

const getBusTypeLabel = (busType) => BUS_TYPE_LABELS[busType] || busType
const getSeatTypeLabel = (seatType) => SEAT_TYPE_LABELS[seatType] || seatType
const isRoomBusType = (busType) => busType === 'LIMOUSINE_22'

export {
  BUS_TYPE_LABELS,
  MANAGED_BUS_CAPACITIES,
  SEAT_TYPE_LABELS,
  getBusTypeLabel,
  getSeatTypeLabel,
  isRoomBusType,
}
