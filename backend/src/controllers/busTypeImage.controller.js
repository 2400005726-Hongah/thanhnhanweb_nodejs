import {
  createBusTypeImage as createBusTypeImageService,
  deleteBusTypeImage as deleteBusTypeImageService,
  listBusTypeImages as listBusTypeImagesService,
  reorderBusTypeImages as reorderBusTypeImagesService,
} from '../services/busTypeImage.service.js'

const listBusTypeImages = async (request, response, next) => {
  try {
    const data = await listBusTypeImagesService(request.query.busType)
    response.status(200).json({
      success: true,
      message: 'Lấy thư viện ảnh loại xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const listPublicBusTypeImages = async (request, response, next) => {
  try {
    const data = await listBusTypeImagesService(request.params.busType, {
      publicOnly: true,
    })
    response.status(200).json({
      success: true,
      message: 'Lấy hình ảnh loại xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const uploadBusTypeImage = async (request, response, next) => {
  try {
    const data = await createBusTypeImageService({
      busType: request.query.busType,
      buffer: request.body,
      mimeType: request.headers['content-type'],
    })
    response.status(201).json({
      success: true,
      message: 'Tải ảnh loại xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const reorderBusTypeImages = async (request, response, next) => {
  try {
    const data = await reorderBusTypeImagesService(
      request.body.busType,
      request.body.ids,
    )
    response.status(200).json({
      success: true,
      message: 'Sắp xếp ảnh loại xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const deleteBusTypeImage = async (request, response, next) => {
  try {
    const data = await deleteBusTypeImageService(request.params.imageId)
    response.status(200).json({
      success: true,
      message: 'Xóa ảnh loại xe thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

export {
  deleteBusTypeImage,
  listBusTypeImages,
  listPublicBusTypeImages,
  reorderBusTypeImages,
  uploadBusTypeImage,
}
