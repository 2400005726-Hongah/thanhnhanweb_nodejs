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

const limousineRoomType = (position) =>
  position >= 10 ? 'DOUBLE_ROOM' : 'SINGLE_ROOM'

const buildLimousine22Template = () => [
  ...buildFloorSeats({
    count: 11,
    floor: 1,
    prefix: 'L',
    resolveSeatType: limousineRoomType,
  }),
  ...buildFloorSeats({
    count: 11,
    floor: 2,
    prefix: 'U',
    resolveSeatType: limousineRoomType,
  }),
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
