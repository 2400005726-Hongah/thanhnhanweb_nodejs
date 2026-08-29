import apiClient from './apiClient.js'

const unwrap = (response) => response.data.data

// Bước 2 -> 3 -> 4 dùng lại cùng thông tin chuyến và điểm phục vụ.
// Cache ngắn hạn cả Promise đang chạy để React StrictMode hoặc chuyển bước nhanh
// không tạo nhiều request Supabase giống hệt nhau. Không cache sơ đồ ghế vì
// trạng thái ghế phải luôn lấy mới.
const STATIC_TRIP_CACHE_TTL_MS = 60_000
const staticTripCache = new Map()

const getCachedStaticTripData = (key, loader) => {
  const now = Date.now()
  const cached = staticTripCache.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  let promise
  promise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      if (staticTripCache.get(key)?.promise === promise) {
        staticTripCache.delete(key)
      }
      throw error
    })

  staticTripCache.set(key, {
    promise,
    expiresAt: now + STATIC_TRIP_CACHE_TTL_MS,
  })

  return promise
}

const getLocations = async (keyword) =>
  unwrap(await apiClient.get('/public/locations', { params: { keyword } }))

const getTripSearchCatalog = async () =>
  unwrap(await apiClient.get('/public/search/catalog'))

const searchTrips = async (params) =>
  unwrap(await apiClient.get('/public/trips/search', { params }))

const getTripDetail = (tripId) =>
  getCachedStaticTripData(`trip:${tripId}`, async () =>
    unwrap(await apiClient.get(`/public/trips/${tripId}`)),
  )

const getTripServicePoints = (tripId) =>
  getCachedStaticTripData(`service-points:${tripId}`, async () =>
    unwrap(await apiClient.get(`/public/trips/${tripId}/service-points`)),
  )

const getTripSeats = async (tripId) =>
  unwrap(await apiClient.get(`/public/trips/${tripId}/seats`))

export {
  getLocations,
  getTripDetail,
  getTripSearchCatalog,
  getTripSeats,
  getTripServicePoints,
  searchTrips,
}
