import { publicApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const getPublicNews = async (params = {}) =>
  unwrap(await publicApiClient.get('/public/news', { params }))

const getPublicNewsDetail = async (id) =>
  unwrap(await publicApiClient.get(`/public/news/${id}`))

export { getPublicNews, getPublicNewsDetail }
