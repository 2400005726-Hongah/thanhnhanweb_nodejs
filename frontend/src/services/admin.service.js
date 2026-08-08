import {
  normalizeBookingCode,
  normalizeEmail,
  normalizeFullName,
  normalizeLicensePlate,
  normalizeLocationName,
  normalizeMultilineText,
  normalizePhone,
  normalizeProvince,
  normalizeRouteName,
  normalizeWhitespace,
} from '../utils/normalizers.js'
import { authApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const normalizeParams = (params = {}) => ({
  ...params,
  ...(params.keyword !== undefined && {
    keyword: normalizeWhitespace(params.keyword),
  }),
})

const normalizeLocationPayload = (payload = {}) => ({
  ...payload,
  ...(payload.name !== undefined && { name: normalizeLocationName(payload.name) }),
  ...(payload.province !== undefined && {
    province: normalizeProvince(payload.province),
  }),
  ...(payload.address !== undefined && {
    address: normalizeWhitespace(payload.address) || null,
  }),
})

const normalizeRoutePayload = (payload = {}) => ({
  ...payload,
  ...(payload.routeName !== undefined && {
    routeName: normalizeRouteName(payload.routeName),
  }),
})

const normalizeBusPayload = (payload = {}) => ({
  ...payload,
  ...(payload.busName !== undefined && {
    busName: normalizeWhitespace(payload.busName),
  }),
  ...(payload.licensePlate !== undefined && {
    licensePlate: normalizeLicensePlate(payload.licensePlate),
  }),
})

const normalizePassengerPayload = (passenger = {}) => ({
  fullName: normalizeFullName(passenger.fullName),
  phone: normalizePhone(passenger.phone),
  ...(passenger.email
    ? { email: normalizeEmail(passenger.email) }
    : { email: undefined }),
})

const resendBookingEmail = async (bookingCode) =>
  unwrap(
    await authApiClient.post(
      `/admin/bookings/${normalizeBookingCode(bookingCode)}/resend-email`,
    ),
  )

const getLocations = async (params = {}) =>
  unwrap(await authApiClient.get('/locations', { params: normalizeParams(params) }))

const createLocation = async (payload) =>
  unwrap(await authApiClient.post('/locations', normalizeLocationPayload(payload)))

const updateLocation = async (id, payload) =>
  unwrap(
    await authApiClient.patch(`/locations/${id}`, normalizeLocationPayload(payload)),
  )

const deleteLocation = async (id) =>
  unwrap(await authApiClient.delete(`/locations/${id}`))

const getDashboard = async () =>
  unwrap(await authApiClient.get('/admin/dashboard/summary'))

const getTrips = async (params = {}) =>
  unwrap(await authApiClient.get('/trips', { params: normalizeParams(params) }))

const getTripSeatMap = async (tripId) =>
  unwrap(await authApiClient.get(`/trips/${tripId}/seats`))

const getTripPassengers = async (tripId) =>
  unwrap(await authApiClient.get(`/trips/${tripId}/passengers`))

const createTrip = async (payload) =>
  unwrap(await authApiClient.post('/trips', payload))

const updateTrip = async (id, payload) =>
  unwrap(await authApiClient.patch(`/trips/${id}`, payload))

const getTripCompletionPreview = async (id) =>
  unwrap(await authApiClient.get(`/trips/${id}/completion-preview`))

const changeTripStatus = async (id, status, options = {}) =>
  unwrap(await authApiClient.patch(`/trips/${id}/status`, { status, ...options }))

const deleteTrip = async (id) =>
  unwrap(await authApiClient.delete(`/trips/${id}`))

const getRoutes = async (params = {}) =>
  unwrap(await authApiClient.get('/routes', { params: normalizeParams(params) }))

const createRoute = async (payload) =>
  unwrap(await authApiClient.post('/routes', normalizeRoutePayload(payload)))

const updateRoute = async (id, payload) =>
  unwrap(
    await authApiClient.patch(`/routes/${id}`, normalizeRoutePayload(payload)),
  )

const deleteRoute = async (id) =>
  unwrap(await authApiClient.delete(`/routes/${id}`))

const getBuses = async (params = {}) =>
  unwrap(await authApiClient.get('/buses', { params: normalizeParams(params) }))

const createBus = async (payload) =>
  unwrap(await authApiClient.post('/buses', normalizeBusPayload(payload)))

const updateBus = async (id, payload) =>
  unwrap(await authApiClient.patch(`/buses/${id}`, normalizeBusPayload(payload)))

const deleteBus = async (id) =>
  unwrap(await authApiClient.delete(`/buses/${id}`))

const getBookings = async (params = {}) =>
  unwrap(
    await authApiClient.get('/admin/bookings', {
      params: normalizeParams(params),
    }),
  )

const getBookingDetail = async (bookingCode) =>
  unwrap(
    await authApiClient.get(
      `/admin/bookings/${normalizeBookingCode(bookingCode)}`,
    ),
  )

const updateBookingContact = async (bookingCode, payload) =>
  unwrap(
    await authApiClient.patch(
      `/admin/bookings/${normalizeBookingCode(bookingCode)}/contact`,
      {
        ...payload,
        ...(payload.passengerFullName !== undefined && {
          passengerFullName: normalizeFullName(payload.passengerFullName),
        }),
        ...(payload.passengerPhone !== undefined && {
          passengerPhone: normalizePhone(payload.passengerPhone),
        }),
        ...(payload.passengerEmail !== undefined && {
          passengerEmail: payload.passengerEmail
            ? normalizeEmail(payload.passengerEmail)
            : '',
        }),
        ...(payload.pickupPoint !== undefined && {
          pickupPoint: normalizeWhitespace(payload.pickupPoint),
        }),
        ...(payload.dropoffPoint !== undefined && {
          dropoffPoint: normalizeWhitespace(payload.dropoffPoint),
        }),
      },
    ),
  )

const createManagedBooking = async (payload) =>
  unwrap(
    await authApiClient.post('/admin/bookings', {
      ...payload,
      passenger: normalizePassengerPayload(payload.passenger),
      pickupPoint: normalizeWhitespace(payload.pickupPoint) || undefined,
      dropoffPoint: normalizeWhitespace(payload.dropoffPoint) || undefined,
      customerNote: normalizeMultilineText(payload.customerNote) || undefined,
      staffNote: normalizeMultilineText(payload.staffNote) || undefined,
    }),
  )

const cancelBooking = async (bookingCode, reason) =>
  unwrap(
    await authApiClient.post(
      `/admin/bookings/${normalizeBookingCode(bookingCode)}/cancel`,
      { reason: normalizeMultilineText(reason) },
    ),
  )

const deleteBooking = async (bookingCode, reason) =>
  unwrap(
    await authApiClient.post(
      `/admin/bookings/${normalizeBookingCode(bookingCode)}/delete`,
      { reason: normalizeMultilineText(reason) },
    ),
  )

const markNoShow = async (bookingCode, reason) =>
  unwrap(
    await authApiClient.post(
      `/admin/bookings/${normalizeBookingCode(bookingCode)}/no-show`,
      { reason: normalizeMultilineText(reason) },
    ),
  )

const getCustomers = async (params = {}) =>
  unwrap(
    await authApiClient.get('/admin/customers', {
      params: normalizeParams(params),
    }),
  )

const getCustomerDetail = async (id, params = {}) =>
  unwrap(await authApiClient.get(`/admin/customers/${id}`, { params }))

const updateCustomer = async (id, payload) =>
  unwrap(
    await authApiClient.patch(`/admin/customers/${id}`, {
      ...payload,
      ...(payload.fullName !== undefined && {
        fullName: normalizeFullName(payload.fullName),
      }),
      ...(payload.phone !== undefined && {
        phone: normalizePhone(payload.phone),
      }),
      ...(payload.email !== undefined && {
        email: payload.email ? normalizeEmail(payload.email) : '',
      }),
    }),
  )

const updateCustomerStatus = async (id, status, reason = '') =>
  unwrap(
    await authApiClient.patch(`/admin/customers/${id}/status`, {
      status,
      ...(normalizeMultilineText(reason) && {
        reason: normalizeMultilineText(reason),
      }),
    }),
  )

const getRevenue = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/revenue/summary', { params }))

const getUsers = async (params = {}) =>
  unwrap(
    await authApiClient.get('/admin/users', {
      params: normalizeParams(params),
    }),
  )

const createUser = async (payload) =>
  unwrap(
    await authApiClient.post('/admin/users', {
      ...payload,
      fullName: normalizeFullName(payload.fullName),
      email: normalizeEmail(payload.email),
      phone: normalizePhone(payload.phone),
    }),
  )

const updateUserStatus = async (id, status) =>
  unwrap(await authApiClient.patch(`/admin/users/${id}/status`, { status }))

const getAuditLogs = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/audit-logs', { params }))

const getNews = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/news', { params }))

const createNews = async (payload) =>
  unwrap(await authApiClient.post('/admin/news', payload))

const updateNews = async (id, payload) =>
  unwrap(await authApiClient.patch(`/admin/news/${id}`, payload))

const updateNewsStatus = async (id, status) =>
  unwrap(await authApiClient.patch(`/admin/news/${id}/status`, { status }))

const deleteNews = async (id) =>
  unwrap(await authApiClient.delete(`/admin/news/${id}`))

export {
  cancelBooking,
  changeTripStatus,
  createBus,
  createLocation,
  createManagedBooking,
  createNews,
  createRoute,
  createTrip,
  createUser,
  deleteBooking,
  deleteBus,
  deleteLocation,
  deleteNews,
  deleteRoute,
  deleteTrip,
  getAuditLogs,
  getBookingDetail,
  getBookings,
  getBuses,
  getCustomerDetail,
  getCustomers,
  getDashboard,
  getLocations,
  getNews,
  getRevenue,
  getRoutes,
  getTripPassengers,
  getTripCompletionPreview,
  getTripSeatMap,
  getTrips,
  getUsers,
  markNoShow,
  resendBookingEmail,
  updateBookingContact,
  updateBus,
  updateCustomer,
  updateCustomerStatus,
  updateLocation,
  updateNews,
  updateNewsStatus,
  updateRoute,
  updateTrip,
  updateUserStatus,
}
