import {
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from '../utils/normalizers.js'
import { authApiClient, publicApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

// API cũ vẫn giữ để tương thích backend/test, nhưng website công khai không còn trang đăng ký.
const register = async (payload) =>
  unwrap(
    await publicApiClient.post('/auth/register', {
      ...payload,
      fullName: normalizeFullName(payload.fullName),
      email: normalizeEmail(payload.email),
      phone: normalizePhone(payload.phone),
    }),
  )

const normalizeIdentifier = (identifier) =>
  String(identifier || '').includes('@')
    ? normalizeEmail(identifier)
    : normalizePhone(identifier)

const login = async (payload) =>
  unwrap(
    await publicApiClient.post('/auth/login', {
      ...payload,
      identifier: normalizeIdentifier(payload.identifier),
    }),
  )

const adminLogin = async (payload) =>
  unwrap(
    await publicApiClient.post('/auth/admin/login', {
      ...payload,
      identifier: normalizeIdentifier(payload.identifier),
    }),
  )

const getCurrentUser = async () =>
  unwrap(await authApiClient.get('/auth/me'))

export { adminLogin, getCurrentUser, login, register }
