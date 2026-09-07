import apiClient, { authApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data
const CACHE_TTL_MS = 5 * 60_000
const publicCache = new Map()

const getPublicBusTypeImages = async (busType) => {
  const key = String(busType || '')
  const now = Date.now()
  const cached = publicCache.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  const promise = apiClient
    .get(`/public/bus-type-images/${encodeURIComponent(key)}`)
    .then(unwrap)
    .catch((error) => {
      publicCache.delete(key)
      throw error
    })

  publicCache.set(key, {
    promise,
    expiresAt: now + CACHE_TTL_MS,
  })

  return promise
}

const getAdminBusTypeImages = async (busType) =>
  unwrap(
    await authApiClient.get('/buses/type-images', {
      params: { busType },
    }),
  )

const uploadBusTypeImage = async (busType, file) => {
  const data = unwrap(
    await authApiClient.post('/buses/type-images/upload', file, {
      params: { busType },
      headers: {
        'Content-Type': file.type,
      },
    }),
  )
  publicCache.delete(String(busType || ''))
  return data
}

const deleteBusTypeImage = async (imageId) => {
  const data = unwrap(await authApiClient.delete(`/buses/type-images/${imageId}`))
  if (data?.image?.busType) publicCache.delete(String(data.image.busType))
  return data
}

const reorderBusTypeImages = async (busType, ids) => {
  const data = unwrap(
    await authApiClient.put('/buses/type-images/order', {
      busType,
      ids,
    }),
  )
  publicCache.delete(String(busType || ''))
  return data
}

export {
  deleteBusTypeImage,
  getAdminBusTypeImages,
  getPublicBusTypeImages,
  reorderBusTypeImages,
  uploadBusTypeImage,
}
