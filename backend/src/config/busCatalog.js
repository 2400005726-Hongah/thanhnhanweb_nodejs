const MANAGED_BUS_TYPES = Object.freeze({
  SLEEPER_34: 'SLEEPER_34',
  LIMOUSINE_22: 'LIMOUSINE_22',
})

const LEGACY_BUS_TYPES = Object.freeze(['SEATED', 'SLEEPER', 'LIMOUSINE'])
const SUPPORTED_BUS_TYPES = Object.freeze([
  ...Object.values(MANAGED_BUS_TYPES),
  ...LEGACY_BUS_TYPES,
])

const buildFloorSeats = ({
  count,
  floor,
  prefix,
  resolveSeatType,
}) =>
  Array.from({ length: count }, (_, index) => ({
    seatCode: `${prefix}${String(index + 1).padStart(2, '0')}`,
    floor,
    seatType: resolveSeatType(index + 1),
    status: 'ACTIVE',
  }))

const buildSleeper34Template = () => [
  ...buildFloorSeats({
    count: 17,
    floor: 1,
    prefix: 'A',
    resolveSeatType: () => 'NORMAL',
  }),
  ...buildFloorSeats({
    count: 17,
    floor: 2,
    prefix: 'B',
    resolveSeatType: () => 'NORMAL',
  }),
]

/*
 * Limousine 22 phòng theo đúng cách bố trí của dự án MVC:
 * - Tầng dưới: DA1..DA5 và DB1..DB5 = 10 phòng vật lý.
 * - Tầng trên : TA1..TA6 và TB1..TB6 = 12 phòng vật lý.
 *
 * Mỗi phòng vật lý KHÔNG bị cố định là phòng đơn hay phòng đôi.
 * Khách chọn loại phòng khi đặt vé. `seatType: SINGLE_ROOM` ở đây chỉ là
 * giá trị nền tương thích schema hiện tại; booking.service sẽ ghi lựa chọn
 * thực tế SINGLE_ROOM/DOUBLE_ROOM vào BookingItem và tính lại giá ở server.
 */
const buildRoomColumn = ({ prefix, count, floor }) =>
  Array.from({ length: count }, (_, index) => ({
    seatCode: `${prefix}${index + 1}`,
    floor,
    seatType: 'SINGLE_ROOM',
    status: 'ACTIVE',
  }))

const buildLimousine22Template = () => [
  ...buildRoomColumn({ prefix: 'DA', count: 5, floor: 1 }),
  ...buildRoomColumn({ prefix: 'DB', count: 5, floor: 1 }),
  ...buildRoomColumn({ prefix: 'TA', count: 6, floor: 2 }),
  ...buildRoomColumn({ prefix: 'TB', count: 6, floor: 2 }),
]

const BUS_CONFIG = Object.freeze({
  [MANAGED_BUS_TYPES.SLEEPER_34]: Object.freeze({
    capacity: 34,
    buildSeats: buildSleeper34Template,
  }),
  [MANAGED_BUS_TYPES.LIMOUSINE_22]: Object.freeze({
    capacity: 22,
    buildSeats: buildLimousine22Template,
  }),
})

const isManagedBusType = (busType) => Boolean(BUS_CONFIG[busType])
const isSupportedBusType = (busType) => SUPPORTED_BUS_TYPES.includes(busType)
const isRoomBusType = (busType) =>
  busType === MANAGED_BUS_TYPES.LIMOUSINE_22

const getBusCapacity = (busType) => BUS_CONFIG[busType]?.capacity ?? null

const getBusSeatTemplate = (busType) => {
  const config = BUS_CONFIG[busType]
  return config ? config.buildSeats().map((seat) => ({ ...seat })) : null
}

export {
  LEGACY_BUS_TYPES,
  MANAGED_BUS_TYPES,
  SUPPORTED_BUS_TYPES,
  getBusCapacity,
  getBusSeatTemplate,
  isManagedBusType,
  isRoomBusType,
  isSupportedBusType,
}
