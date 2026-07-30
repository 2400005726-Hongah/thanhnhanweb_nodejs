import { authApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const getDashboard = async () =>
  unwrap(await authApiClient.get('/admin/dashboard/summary'))

const getTrips = async (params = {}) =>
  unwrap(await authApiClient.get('/trips', { params }))

const createTrip = async (payload) =>
  unwrap(await authApiClient.post('/trips', payload))

const updateTrip = async (id, payload) =>
  unwrap(await authApiClient.patch(`/trips/${id}`, payload))

const deleteTrip = async (id) =>
  unwrap(await authApiClient.delete(`/trips/${id}`))

const getRoutes = async (params = {}) =>
  unwrap(await authApiClient.get('/routes', { params }))

const createRoute = async (payload) =>
  unwrap(await authApiClient.post('/routes', payload))

const updateRoute = async (id, payload) =>
  unwrap(await authApiClient.patch(`/routes/${id}`, payload))

const deleteRoute = async (id) =>
  unwrap(await authApiClient.delete(`/routes/${id}`))

const getBuses = async (params = {}) =>
  unwrap(await authApiClient.get('/buses', { params }))

const createBus = async (payload) =>
  unwrap(await authApiClient.post('/buses', payload))

const updateBus = async (id, payload) =>
  unwrap(await authApiClient.patch(`/buses/${id}`, payload))

const deleteBus = async (id) =>
  unwrap(await authApiClient.delete(`/buses/${id}`))

const getBookings = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/bookings', { params }))

const cancelBooking = async (bookingCode) =>
  unwrap(
    await authApiClient.post(`/admin/bookings/${bookingCode}/cancel`),
  )

const markNoShow = async (bookingCode, reason) =>
  unwrap(
    await authApiClient.post(`/admin/bookings/${bookingCode}/no-show`, {
      reason,
    }),
  )

const getCustomers = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/customers', { params }))

const updateCustomer = async (id, payload) =>
  unwrap(await authApiClient.patch(`/admin/customers/${id}`, payload))

const getRevenue = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/revenue/summary', { params }))

const getUsers = async (params = {}) =>
  unwrap(await authApiClient.get('/admin/users', { params }))

const createUser = async (payload) =>
  unwrap(await authApiClient.post('/admin/users', payload))

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
  createNews,
  createBus,
  createRoute,
  createTrip,
  createUser,
  deleteNews,
  deleteBus,
  deleteRoute,
  deleteTrip,
  getAuditLogs,
  getBookings,
  getBuses,
  getCustomers,
  getDashboard,
  getNews,
  getRevenue,
  getRoutes,
  getTrips,
  getUsers,
  markNoShow,
  updateNews,
  updateNewsStatus,
  updateBus,
  updateCustomer,
  updateRoute,
  updateTrip,
  updateUserStatus,
}
