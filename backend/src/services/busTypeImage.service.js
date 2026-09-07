import prisma from '../config/prisma.js'
import { MANAGED_BUS_TYPES } from '../config/busCatalog.js'
import HttpError from '../utils/HttpError.js'
import {
  deleteBusTypeImageFile,
  uploadBusTypeImageFile,
} from './busTypeImageStorage.service.js'

const ALLOWED_BUS_TYPES = Object.freeze(Object.values(MANAGED_BUS_TYPES))

const ensureBusType = (value) => {
  const busType = String(value || '').trim()
  if (!ALLOWED_BUS_TYPES.includes(busType)) {
    throw new HttpError(
      'Loại xe chỉ hỗ trợ Giường nằm 34 giường hoặc Limousine 22 phòng',
      400,
    )
  }
  return busType
}

const normalizeId = (value) => {
  const id = String(value || '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError('Mã ảnh loại xe không hợp lệ', 400)
  }
  return id
}

const mapImage = (row) => ({
  id: row.id,
  busType: row.busType,
  imageUrl: row.imageUrl,
  storagePath: row.storagePath,
  sortOrder: Number(row.sortOrder || 0),
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const handleDbError = (error) => {
  const message = String(error?.message || '')
  if (/bus_type_images|relation .* does not exist/i.test(message)) {
    throw new HttpError(
      'Chưa có bảng bus_type_images. Hãy chạy file docs/SETUP_BUS_TYPE_IMAGES.sql trên Supabase.',
      500,
    )
  }
  throw error
}

/*
 * QUAN TRỌNG:
 * Module này dùng raw SQL qua Prisma thay vì prisma.busTypeImage.
 * Lý do: project hiện tại dùng Prisma Client custom/generated và client đang chưa
 * nhận model BusTypeImage, khiến prisma.busTypeImage === undefined.
 * $queryRaw/$executeRaw vẫn dùng đúng kết nối PostgreSQL hiện tại và không phụ
 * thuộc model generated nên ổn định ngay với bảng bus_type_images đã tạo.
 */
const listBusTypeImages = async (busType, { publicOnly = false } = {}) => {
  const normalizedType = ensureBusType(busType)

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        bus_type AS "busType",
        image_url AS "imageUrl",
        storage_path AS "storagePath",
        sort_order AS "sortOrder",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM public.bus_type_images
      WHERE bus_type = ${normalizedType}
        AND (${!publicOnly}::boolean OR is_active = true)
      ORDER BY sort_order ASC, created_at ASC
    `

    return {
      busType: normalizedType,
      images: rows.map(mapImage),
    }
  } catch (error) {
    return handleDbError(error)
  }
}

const createBusTypeImage = async ({ busType, buffer, mimeType }) => {
  const normalizedType = ensureBusType(busType)

  let nextSortOrder = 1
  try {
    const rows = await prisma.$queryRaw`
      SELECT COALESCE(MAX(sort_order), 0)::int AS "sortOrder"
      FROM public.bus_type_images
      WHERE bus_type = ${normalizedType}
    `
    nextSortOrder = Number(rows?.[0]?.sortOrder || 0) + 1
  } catch (error) {
    return handleDbError(error)
  }

  // Chỉ upload Storage sau khi DB đã truy vấn được bình thường.
  const uploaded = await uploadBusTypeImageFile({
    buffer,
    mimeType,
    busType: normalizedType,
  })

  try {
    const rows = await prisma.$queryRaw`
      INSERT INTO public.bus_type_images (
        bus_type,
        image_url,
        storage_path,
        sort_order,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${normalizedType},
        ${uploaded.url},
        ${uploaded.path},
        ${nextSortOrder},
        true,
        now(),
        now()
      )
      RETURNING
        id,
        bus_type AS "busType",
        image_url AS "imageUrl",
        storage_path AS "storagePath",
        sort_order AS "sortOrder",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `

    return { image: mapImage(rows[0]) }
  } catch (error) {
    try {
      await deleteBusTypeImageFile(uploaded.path)
    } catch {
      // Không che mất lỗi DB gốc.
    }
    return handleDbError(error)
  }
}

const deleteBusTypeImage = async (imageId) => {
  const id = normalizeId(imageId)

  let image
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        bus_type AS "busType",
        image_url AS "imageUrl",
        storage_path AS "storagePath",
        sort_order AS "sortOrder",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM public.bus_type_images
      WHERE id = ${id}::uuid
      LIMIT 1
    `
    image = rows?.[0] ? mapImage(rows[0]) : null
  } catch (error) {
    return handleDbError(error)
  }

  if (!image) {
    throw new HttpError('Không tìm thấy ảnh loại xe', 404)
  }

  try {
    await prisma.$executeRaw`
      DELETE FROM public.bus_type_images
      WHERE id = ${id}::uuid
    `
  } catch (error) {
    return handleDbError(error)
  }

  try {
    await deleteBusTypeImageFile(image.storagePath)
  } catch {
    // DB đã bỏ tham chiếu ảnh. File mồ côi có thể dọn sau nếu Storage tạm lỗi.
  }

  return { image }
}

const reorderBusTypeImages = async (busType, orderedIds) => {
  const normalizedType = ensureBusType(busType)
  const ids = Array.isArray(orderedIds)
    ? [...new Set(orderedIds.map((id) => normalizeId(id)))]
    : []

  let current
  try {
    current = await prisma.$queryRaw`
      SELECT id
      FROM public.bus_type_images
      WHERE bus_type = ${normalizedType}
      ORDER BY sort_order ASC, created_at ASC
    `
  } catch (error) {
    return handleDbError(error)
  }

  if (ids.length !== current.length) {
    throw new HttpError('Danh sách sắp xếp ảnh không đầy đủ', 400)
  }

  const currentIds = new Set(current.map((item) => String(item.id)))
  if (ids.some((id) => !currentIds.has(id))) {
    throw new HttpError(
      'Danh sách sắp xếp chứa ảnh không thuộc loại xe đã chọn',
      400,
    )
  }

  // Chạy tuần tự: số ảnh ít, tránh transaction timeout khi Supabase chậm.
  for (const [index, id] of ids.entries()) {
    try {
      await prisma.$executeRaw`
        UPDATE public.bus_type_images
        SET sort_order = ${index + 1}, updated_at = now()
        WHERE id = ${id}::uuid
          AND bus_type = ${normalizedType}
      `
    } catch (error) {
      return handleDbError(error)
    }
  }

  return listBusTypeImages(normalizedType)
}

export {
  createBusTypeImage,
  deleteBusTypeImage,
  listBusTypeImages,
  reorderBusTypeImages,
}
