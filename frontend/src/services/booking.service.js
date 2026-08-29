import {
  normalizeBookingCode,
  normalizeEmail,
  normalizeFullName,
  normalizeMultilineText,
  normalizePhone,
  normalizeWhitespace,
} from '../utils/normalizers.js'
import apiClient, { authApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const holdSeats = async (
  tripId,
  tripSeatIds,
  roomSelections = [],
  holdToken = undefined,
) =>
  unwrap(
    await apiClient.post(`/public/trips/${tripId}/seats/hold`, {
      tripSeatIds,
      ...(roomSelections.length && { roomSelections }),
      ...(holdToken && { holdToken }),
    }),
  )

const releaseSeatHold = async (tripId, holdToken) =>
  unwrap(
    await apiClient.delete(`/public/trips/${tripId}/seats/hold`, {
      data: { holdToken },
    }),
  )

const createBooking = async ({
  tripId,
  holdToken,
  passenger,
  pickupKind,
  dropoffKind,
  pickupServicePointId,
  dropoffServicePointId,
  pickupRequestedAddress,
  dropoffRequestedAddress,
  customerNote,
  paymentMethod,
  roomSelections = [],
}) => {
  return unwrap(
    await apiClient.post(
      '/public/bookings',
      {
        tripId,
        holdToken,
        ...(roomSelections.length && { roomSelections }),
        passenger: {
          fullName: normalizeFullName(passenger?.fullName),
          phone: normalizePhone(passenger?.phone),
          email: normalizeEmail(passenger?.email),
        },
        pickupKind,
        dropoffKind,
        pickupServicePointId: pickupServicePointId || undefined,
        dropoffServicePointId: dropoffServicePointId || undefined,
        pickupRequestedAddress:
          normalizeWhitespace(pickupRequestedAddress) || undefined,
        dropoffRequestedAddress:
          normalizeWhitespace(dropoffRequestedAddress) || undefined,
        customerNote: normalizeMultilineText(customerNote) || undefined,
        paymentMethod,
      },
      {
        // Transaction backend tối đa 15 giây. Cho request tạo vé dư thời gian
        // để frontend không tự ngắt kết nối trước khi máy chủ trả kết quả.
        timeout: 45_000,
      },
    ),
  )
}

const simulatePayment = async (bookingCode, phone) =>
  unwrap(
    await apiClient.post(
      `/public/bookings/${normalizeBookingCode(bookingCode)}/payments/simulate`,
      { phone: normalizePhone(phone), paymentMethod: 'SIMULATED' },
    ),
  )

const lookupBooking = async (bookingCode, phone) =>
  unwrap(
    await apiClient.get('/public/bookings/lookup', {
      params: {
        bookingCode: normalizeBookingCode(bookingCode),
        phone: normalizePhone(phone),
      },
    }),
  )

const getMyBookings = async (params) =>
  unwrap(await authApiClient.get('/bookings/me', { params }))

const cancelMyBooking = async (bookingCode, reason) =>
  unwrap(
    await authApiClient.post(
      `/bookings/${normalizeBookingCode(bookingCode)}/cancel`,
      { reason: normalizeMultilineText(reason) },
    ),
  )

const cancelGuestBooking = async (bookingCode, phone, reason) =>
  unwrap(
    await apiClient.post(
      `/public/bookings/${normalizeBookingCode(bookingCode)}/cancel`,
      {
        phone: normalizePhone(phone),
        reason: normalizeMultilineText(reason),
      },
    ),
  )

export {
  cancelGuestBooking,
  cancelMyBooking,
  createBooking,
  getMyBookings,
  holdSeats,
  lookupBooking,
  releaseSeatHold,
  simulatePayment,
}
