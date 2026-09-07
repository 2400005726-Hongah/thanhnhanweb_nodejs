import { randomUUID } from 'node:crypto'

import env from '../config/env.js'
import HttpError from '../utils/HttpError.js'

const BUS_TYPE_IMAGE_MIME_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
})

const MAX_BUS_TYPE_IMAGE_SIZE = 5 * 1024 * 1024
const BUS_TYPE_IMAGE_FOLDER = 'bus-types'
const DEFAULT_BUCKET = 'bus-type-images'

const getStorageConfig = () => {
  const baseUrl = String(env.supabaseUrl || '').replace(/\/+$/, '')
  const secretKey = String(env.supabaseSecretKey || '').trim()
  const bucket = String(env.busTypeImageBucket || DEFAULT_BUCKET).trim()

  if (!baseUrl || !secretKey) {
    throw new HttpError(
      'Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SECRET_KEY để tải ảnh loại xe',
      500,
    )
  }

  return { baseUrl, secretKey, bucket }
}

const encodeStoragePath = (path) =>
  String(path)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

const readStorageError = async (response) => {
  try {
    const data = await response.json()
    return data?.message || data?.error || data?.statusCode || 'Lỗi Supabase Storage'
  } catch {
    return 'Lỗi Supabase Storage'
  }
}

const uploadBusTypeImageFile = async ({ buffer, mimeType, busType }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new HttpError('Vui lòng chọn ảnh để tải lên', 400)
  }

  const extension = BUS_TYPE_IMAGE_MIME_TYPES[mimeType]
  if (!extension) {
    throw new HttpError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP', 400)
  }

  if (buffer.length > MAX_BUS_TYPE_IMAGE_SIZE) {
    throw new HttpError('Ảnh không được vượt quá 5 MB', 400)
  }

  const { baseUrl, secretKey, bucket } = getStorageConfig()
  const path = `${BUS_TYPE_IMAGE_FOLDER}/${busType}/${randomUUID()}.${extension}`

  const response = await fetch(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`,
    {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'false',
        'Cache-Control': '3600',
      },
      body: buffer,
    },
  )

  if (!response.ok) {
    const detail = await readStorageError(response)
    throw new HttpError(`Không thể tải ảnh loại xe lên Supabase Storage: ${detail}`, 502)
  }

  return {
    path,
    url: `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`,
  }
}

const deleteBusTypeImageFile = async (path) => {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/').trim()
  if (
    !normalized.startsWith(`${BUS_TYPE_IMAGE_FOLDER}/`) ||
    normalized.includes('..') ||
    normalized.length > 500
  ) {
    return false
  }

  const { baseUrl, secretKey, bucket } = getStorageConfig()
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [normalized] }),
    },
  )

  if (!response.ok) {
    const detail = await readStorageError(response)
    throw new HttpError(`Không thể xóa ảnh loại xe khỏi Supabase Storage: ${detail}`, 502)
  }

  return true
}

export {
  BUS_TYPE_IMAGE_MIME_TYPES,
  MAX_BUS_TYPE_IMAGE_SIZE,
  deleteBusTypeImageFile,
  uploadBusTypeImageFile,
}
