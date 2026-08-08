import {
  getBusCapacity,
  getBusSeatTemplate,
  isManagedBusType,
  isSupportedBusType,
} from '../src/config/busCatalog.js'
import {
  isSeatAvailable,
  summarizeTripSeats,
} from '../src/services/seatAvailability.service.js'
import {
  getTripSeatPrice,
  resolveTripPricing,
  serializeTripPricing,
} from '../src/services/tripPricing.service.js'

describe('Phase 3 centralized bus templates', () => {
  test('builds exactly 34 unique sleeper positions over two floors', () => {
    const seats = getBusSeatTemplate('SLEEPER_34')

    expect(getBusCapacity('SLEEPER_34')).toBe(34)
    expect(seats).toHaveLength(34)
    expect(new Set(seats.map((seat) => seat.seatCode)).size).toBe(34)
    expect(seats.filter((seat) => seat.floor === 1)).toHaveLength(17)
    expect(seats.filter((seat) => seat.floor === 2)).toHaveLength(17)
    expect(seats.every((seat) => seat.seatType === 'NORMAL')).toBe(true)
  })

  test('builds exactly 22 unique limousine rooms over two floors', () => {
    const rooms = getBusSeatTemplate('LIMOUSINE_22')

    expect(getBusCapacity('LIMOUSINE_22')).toBe(22)
    expect(rooms).toHaveLength(22)
    expect(new Set(rooms.map((room) => room.seatCode)).size).toBe(22)
    expect(rooms.filter((room) => room.floor === 1)).toHaveLength(10)
    expect(rooms.filter((room) => room.floor === 2)).toHaveLength(12)
    expect(rooms.map((room) => room.seatCode)).toEqual([
      'DA1', 'DA2', 'DA3', 'DA4', 'DA5',
      'DB1', 'DB2', 'DB3', 'DB4', 'DB5',
      'TA1', 'TA2', 'TA3', 'TA4', 'TA5', 'TA6',
      'TB1', 'TB2', 'TB3', 'TB4', 'TB5', 'TB6',
    ])
    // Phòng vật lý không bị cố định đơn/đôi; loại phòng được chọn khi đặt vé.
    expect(rooms.every((room) => room.seatType === 'SINGLE_ROOM')).toBe(true)
  })

  test('keeps legacy bus types readable but outside managed templates', () => {
    for (const busType of ['SLEEPER', 'LIMOUSINE', 'SEATED']) {
      expect(isSupportedBusType(busType)).toBe(true)
      expect(isManagedBusType(busType)).toBe(false)
      expect(getBusSeatTemplate(busType)).toBeNull()
    }
  })
})

describe('Phase 3 server-side pricing rules', () => {
  test('uses sleeper trip price before route default price', () => {
    const pricing = resolveTripPricing({
      busType: 'SLEEPER_34',
      route: { defaultTicketPrice: 280000 },
      ticketPrice: 320000,
    })

    expect(serializeTripPricing(pricing).ticketPrice).toBe(320000)
  })

  test('falls back to sleeper route price when trip price is null', () => {
    const pricing = resolveTripPricing({
      busType: 'SLEEPER_34',
      route: { defaultTicketPrice: 280000 },
      ticketPrice: null,
    })

    expect(serializeTripPricing(pricing).ticketPrice).toBe(280000)
  })

  test('resolves distinct single and double prices from trip overrides', () => {
    const pricing = resolveTripPricing({
      busType: 'LIMOUSINE_22',
      route: {
        defaultSingleRoomPrice: 400000,
        defaultDoubleRoomPrice: 650000,
      },
      singleRoomPrice: 450000,
      doubleRoomPrice: 720000,
    })

    expect(getTripSeatPrice(pricing, 'SINGLE_ROOM')).toBe(450000)
    expect(getTripSeatPrice(pricing, 'DOUBLE_ROOM')).toBe(720000)
  })

  test('falls back to route prices for both limousine room types', () => {
    const pricing = serializeTripPricing(
      resolveTripPricing({
        busType: 'LIMOUSINE_22',
        route: {
          defaultSingleRoomPrice: 410000,
          defaultDoubleRoomPrice: 680000,
        },
      }),
    )

    expect(pricing.singleRoomPrice).toBe(410000)
    expect(pricing.doubleRoomPrice).toBe(680000)
  })

  test('rejects a trip when neither trip nor route has a usable price', () => {
    expect(() =>
      resolveTripPricing({
        busType: 'SLEEPER_34',
        route: {},
      }),
    ).toThrow('Chưa cấu hình giá vé')
  })
})

describe('Phase 3 shared seat availability rules', () => {
  test('counts an expired HELD seat as available everywhere', () => {
    const now = new Date('2099-01-01T00:00:00.000Z')
    const seats = [
      { status: 'AVAILABLE', holdExpiresAt: null },
      {
        status: 'HELD',
        holdExpiresAt: new Date('2098-12-31T23:59:00.000Z'),
      },
      {
        status: 'HELD',
        holdExpiresAt: new Date('2099-01-01T00:10:00.000Z'),
      },
      { status: 'BOOKED', holdExpiresAt: null },
    ]

    expect(isSeatAvailable(seats[1], now)).toBe(true)
    expect(summarizeTripSeats(seats, now)).toEqual({
      total: 4,
      available: 2,
      held: 1,
      booked: 1,
    })
  })
})
