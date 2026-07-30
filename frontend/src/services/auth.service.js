import { authApiClient, publicApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const register = async (payload) =>
  unwrap(await publicApiClient.post('/auth/register', payload))

const login = async (payload) =>
  unwrap(await publicApiClient.post('/auth/login', payload))

const getCurrentUser = async () =>
  unwrap(await authApiClient.get('/auth/me'))

export { getCurrentUser, login, register }
