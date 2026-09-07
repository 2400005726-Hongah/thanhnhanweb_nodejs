import {
  changeNewsStatus as changeNewsStatusService,
  createNews as createNewsService,
  getNewsById,
  getPublicNewsById,
  listNews as listNewsService,
  softDeleteNews,
  updateNews as updateNewsService,
} from '../services/news.service.js'
import {
  deleteNewsImage as deleteNewsImageService,
  uploadNewsImage as uploadNewsImageService,
} from '../services/newsImageStorage.service.js'

const listPublicNews = async (request, response, next) => {
  try {
    const data = await listNewsService(request.query, { publicOnly: true })
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách tin tức thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const showPublicNews = async (request, response, next) => {
  try {
    const news = await getPublicNewsById(request.params.id)
    response.status(200).json({
      success: true,
      message: 'Lấy tin tức thành công',
      data: { news },
    })
  } catch (error) {
    next(error)
  }
}

const listNews = async (request, response, next) => {
  try {
    const data = await listNewsService(request.query)
    response.status(200).json({
      success: true,
      message: 'Lấy danh sách tin tức thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const showNews = async (request, response, next) => {
  try {
    const news = await getNewsById(request.params.id)
    response.status(200).json({
      success: true,
      message: 'Lấy tin tức thành công',
      data: { news },
    })
  } catch (error) {
    next(error)
  }
}

const uploadNewsImage = async (request, response, next) => {
  try {
    const mimeType = String(request.get('content-type') || '')
      .split(';')[0]
      .trim()

    const image = await uploadNewsImageService({
      buffer: request.body,
      mimeType,
    })

    response.status(201).json({
      success: true,
      message: 'Tải ảnh tin tức thành công',
      data: { image },
    })
  } catch (error) {
    next(error)
  }
}

const removeNewsImage = async (request, response, next) => {
  try {
    const image = await deleteNewsImageService(request.body.path)
    response.status(200).json({
      success: true,
      message: 'Xóa ảnh tạm thành công',
      data: { image },
    })
  } catch (error) {
    next(error)
  }
}

const createNews = async (request, response, next) => {
  try {
    const news = await createNewsService(request.body, request.user)
    response.status(201).json({
      success: true,
      message: 'Tạo tin tức thành công',
      data: { news },
    })
  } catch (error) {
    next(error)
  }
}

const updateNews = async (request, response, next) => {
  try {
    const news = await updateNewsService(
      request.params.id,
      request.body,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật tin tức thành công',
      data: { news },
    })
  } catch (error) {
    next(error)
  }
}

const changeNewsStatus = async (request, response, next) => {
  try {
    const news = await changeNewsStatusService(
      request.params.id,
      request.body.status,
      request.user,
    )
    response.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái tin tức thành công',
      data: { news },
    })
  } catch (error) {
    next(error)
  }
}

const deleteNews = async (request, response, next) => {
  try {
    const news = await softDeleteNews(request.params.id, request.user)
    response.status(200).json({
      success: true,
      message: 'Xóa mềm tin tức thành công',
      data: { news },
    })
  } catch (error) {
    next(error)
  }
}

export {
  changeNewsStatus,
  createNews,
  deleteNews,
  listNews,
  listPublicNews,
  removeNewsImage,
  showNews,
  showPublicNews,
  updateNews,
  uploadNewsImage,
}
