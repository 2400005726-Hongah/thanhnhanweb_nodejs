import { randomUUID } from 'node:crypto'

import env from '../config/env.js'
import HttpError from '../utils/HttpError.js'

const NEWS_IMAGE_MIME_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
})

const MAX_NEWS_IMAGE_SIZE = 5 * 1024 * 1024
const NEWS_IMAGE_FOLDER = 'news'

const getStorageConfig = () => {
  const baseUrl = String(env.supabaseUrl || '').replace(/\/+$/, '')
  const secretKey = String(env.supabaseSecretKey || '').trim()
  const bucket = String(env.newsImageBucket || 'news-images').trim()

  if (!baseUrl || !secretKey) {
    throw new HttpError(
      'Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SECRET_KEY để tải ảnh tin tức',
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

const normalizeStoragePath = (path) => {
  const normalized = String(path || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .trim()

  if (
    !normalized.startsWith(`${NEWS_IMAGE_FOLDER}/`) ||
    normalized.includes('..') ||
    normalized.length > 500
  ) {
    throw new HttpError('Đường dẫn ảnh tin tức không hợp lệ', 400)
  }

  return normalized
}

const readStorageError = async (response) => {
  try {
    const data = await response.json()
    return data?.message || data?.error || data?.statusCode || 'Lỗi Supabase Storage'
  } catch {
    return 'Lỗi Supabase Storage'
  }
}

const uploadNewsImage = async ({ buffer, mimeType }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new HttpError('Vui lòng chọn ảnh để tải lên', 400)
  }

  const extension = NEWS_IMAGE_MIME_TYPES[mimeType]
  if (!extension) {
    throw new HttpError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP', 400)
  }

  if (buffer.length > MAX_NEWS_IMAGE_SIZE) {
    throw new HttpError('Ảnh không được vượt quá 5 MB', 400)
  }

  const { baseUrl, secretKey, bucket } = getStorageConfig()
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const path = `${NEWS_IMAGE_FOLDER}/${year}/${month}/${randomUUID()}.${extension}`

  const response = await fetch(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`,
    {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': mimeType,
        'x-upsert': 'false',
        'Cache-Control': '3600',
      },
      body: buffer,
    },
  )

  if (!response.ok) {
    const detail = await readStorageError(response)
    throw new HttpError(`Không thể tải ảnh lên Supabase Storage: ${detail}`, 502)
  }

  return {
    path,
    url: `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`,
    size: buffer.length,
    mimeType,
  }
}

const deleteNewsImage = async (path) => {
  const normalizedPath = normalizeStoragePath(path)
  const { baseUrl, secretKey, bucket } = getStorageConfig()

  const response = await fetch(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [normalizedPath] }),
    },
  )

  if (!response.ok) {
    const detail = await readStorageError(response)
    throw new HttpError(`Không thể xóa ảnh khỏi Supabase Storage: ${detail}`, 502)
  }

  return { path: normalizedPath }
}

const getManagedNewsImagePath = (url) => {
  if (!url) return null

  const { baseUrl, bucket } = getStorageConfig()
  const prefix = `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/`
  const value = String(url)

  if (!value.startsWith(prefix)) return null

  try {
    return normalizeStoragePath(
      value
        .slice(prefix.length)
        .split('/')
        .map((part) => decodeURIComponent(part))
        .join('/'),
    )
  } catch {
    return null
  }
}

const deleteManagedNewsImageByUrl = async (url) => {
  const path = getManagedNewsImagePath(url)
  if (!path) return false

  await deleteNewsImage(path)
  return true
}

export {
  MAX_NEWS_IMAGE_SIZE,
  NEWS_IMAGE_MIME_TYPES,
  deleteManagedNewsImageByUrl,
  deleteNewsImage,
  getManagedNewsImagePath,
  uploadNewsImage,
}
