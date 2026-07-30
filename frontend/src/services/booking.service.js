import { getAuthSession } from '../utils/authStorage.js'
import apiClient, { authApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const holdSeats = async (tripId, tripSeatIds) =>
  unwrap(
    await apiClient.post(`/public/trips/${tripId}/seats/hold`, {
      tripSeatIds,
    }),
  )

const releaseSeatHold = async (tripId, holdToken) =>
  unwrap(
    await apiClient.delete(`/public/trips/${tripId}/seats/hold`, {
      data: { holdToken },
    }),
  )

const createBooking = async ({ tripId, holdToken, passenger, customerNote }) => {
  const client = getAuthSession()?.token ? authApiClient : apiClient

  return unwrap(
    await client.post('/public/bookings', {
      tripId,
      holdToken,
      passenger,
      customerNote: customerNote || undefined,
    }),
  )
}

const simulatePayment = async (bookingCode, phone) =>
  unwrap(
    await apiClient.post(
      `/public/bookings/${bookingCode}/payments/simulate`,
      { phone, paymentMethod: 'SIMULATED' },
    ),
  )

const lookupBooking = async (bookingCode, phone) =>
  unwrap(
    await apiClient.get('/public/bookings/lookup', {
      params: { bookingCode, phone },
    }),
  )

const getMyBookings = async (params) =>
  unwrap(await authApiClient.get('/bookings/me', { params }))

const cancelMyBooking = async (bookingCode, reason) =>
  unwrap(
    await authApiClient.post(`/bookings/${bookingCode}/cancel`, { reason }),
  )

const cancelGuestBooking = async (bookingCode, phone, reason) =>
  unwrap(
    await apiClient.post(`/public/bookings/${bookingCode}/cancel`, {
      phone,
      reason,
    }),
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
