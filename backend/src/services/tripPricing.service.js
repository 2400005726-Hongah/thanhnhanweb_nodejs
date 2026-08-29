import { isRoomBusType } from '../config/busCatalog.js'
import HttpError from '../utils/HttpError.js'

const hasPrice = (value) =>
  value !== undefined && value !== null && value !== ''

const firstPrice = (...values) => values.find(hasPrice)

const requirePrice = (value, message) => {
  if (!hasPrice(value)) {
    throw new HttpError(message, 400)
  }
  return value
}

const resolveTripPricing = ({
  busType,
  route = {},
  ticketPrice,
  singleRoomPrice,
  doubleRoomPrice,
}) => {
  const routePricing = route || {}
  if (isRoomBusType(busType)) {
    const resolvedSingleRoomPrice = requirePrice(
      firstPrice(
        singleRoomPrice,
        routePricing.defaultSingleRoomPrice,
        ticketPrice,
        routePricing.defaultTicketPrice,
      ),
      'Chưa cấu hình giá phòng đơn cho chuyến hoặc tuyến',
    )
    const resolvedDoubleRoomPrice = requirePrice(
      firstPrice(
        doubleRoomPrice,
        routePricing.defaultDoubleRoomPrice,
        ticketPrice,
        routePricing.defaultTicketPrice,
      ),
      'Chưa cấu hình giá phòng đôi cho chuyến hoặc tuyến',
    )

    return {
      ticketPrice: firstPrice(
        ticketPrice,
        routePricing.defaultTicketPrice,
        resolvedSingleRoomPrice,
      ),
      singleRoomPrice: resolvedSingleRoomPrice,
      doubleRoomPrice: resolvedDoubleRoomPrice,
    }
  }

  return {
    ticketPrice: requirePrice(
      firstPrice(ticketPrice, routePricing.defaultTicketPrice),
      'Chưa cấu hình giá vé cho chuyến hoặc tuyến',
    ),
    singleRoomPrice: null,
    doubleRoomPrice: null,
  }
}

const getTripSeatPrice = (pricing, seatType) => {
  if (seatType === 'SINGLE_ROOM') return pricing.singleRoomPrice
  if (seatType === 'DOUBLE_ROOM') return pricing.doubleRoomPrice
  return pricing.ticketPrice
}

const toSafeMoneyNumber = (value, fieldName) => {
  const number = Number(value)
  if (
    !Number.isFinite(number) ||
    !Number.isSafeInteger(Math.round(number * 100))
  ) {
    throw new HttpError(
      `Giá trị ${fieldName} không thể chuyển đổi an toàn`,
      500,
    )
  }
  return number
}

const serializeTripPricing = (pricing) => ({
  ticketPrice: toSafeMoneyNumber(pricing.ticketPrice, 'giá vé'),
  singleRoomPrice:
    pricing.singleRoomPrice == null
      ? null
      : toSafeMoneyNumber(pricing.singleRoomPrice, 'giá phòng đơn'),
  doubleRoomPrice:
    pricing.doubleRoomPrice == null
      ? null
      : toSafeMoneyNumber(pricing.doubleRoomPrice, 'giá phòng đôi'),
})

export {
  getTripSeatPrice,
  hasPrice,
  resolveTripPricing,
  serializeTripPricing,
  toSafeMoneyNumber,
}
