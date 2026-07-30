import apiClient from './apiClient.js'

const unwrap = (response) => response.data.data

const getLocations = async (keyword) =>
  unwrap(await apiClient.get('/public/locations', { params: { keyword } }))

const searchTrips = async (params) =>
  unwrap(await apiClient.get('/public/trips/search', { params }))

const getTripDetail = async (tripId) =>
  unwrap(await apiClient.get(`/public/trips/${tripId}`))

const getTripSeats = async (tripId) =>
  unwrap(await apiClient.get(`/public/trips/${tripId}/seats`))

export { getLocations, getTripDetail, getTripSeats, searchTrips }
