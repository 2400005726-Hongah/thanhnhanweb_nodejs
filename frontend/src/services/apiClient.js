import axios from 'axios'

import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthSession,
  getAuthSession,
} from '../utils/authStorage.js'

const clientOptions = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
}

const publicApiClient = axios.create(clientOptions)
const authApiClient = axios.create(clientOptions)

authApiClient.interceptors.request.use((config) => {
  const token = getAuthSession()?.token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

authApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthSession()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
    }

    return Promise.reject(error)
  },
)

export const getApiErrorMessage = (error) =>
  error.response?.data?.message ||
  (error.code === 'ECONNABORTED'
    ? 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.'
    : 'Không thể kết nối máy chủ. Vui lòng kiểm tra lại kết nối.')

export { authApiClient, publicApiClient }
export default publicApiClient
