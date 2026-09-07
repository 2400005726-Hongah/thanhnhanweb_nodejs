import { authApiClient } from './apiClient.js'

const unwrap = (response) => response.data.data

const uploadNewsEditorImage = async (file) =>
  unwrap(
    await authApiClient.post('/admin/news/images', file, {
      headers: { 'Content-Type': file.type },
      timeout: 30_000,
    }),
  )

const deleteNewsEditorImage = async (path) =>
  unwrap(
    await authApiClient.delete('/admin/news/images', {
      data: { path },
      timeout: 15_000,
    }),
  )

export { deleteNewsEditorImage, uploadNewsEditorImage }
