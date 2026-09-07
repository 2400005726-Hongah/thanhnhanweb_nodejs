import sanitizeHtml from 'sanitize-html'

import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { normalizeWhitespace } from '../utils/normalize.js'
import { buildPagination, parsePagination } from '../utils/query.js'
import { writeAuditLog } from './auditLog.service.js'
import { deleteManagedNewsImageByUrl } from './newsImageStorage.service.js'

const NEWS_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT', 'PUBLISHED']

const authorSelect = {
  id: true,
  fullName: true,
  role: true,
}

const newsListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  thumbnailUrl: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  createdBy: { select: authorSelect },
  updatedBy: { select: authorSelect },
}

const newsDetailSelect = {
  ...newsListSelect,
  content: true,
  createdById: true,
  updatedById: true,
}

const cleanPlainText = (value) =>
  sanitizeHtml(String(value || ''), {
    allowedTags: [],
    allowedAttributes: {},
  }).trim()

const cleanContent = (value) =>
  sanitizeHtml(String(value || ''), {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'a',
      'h2',
      'h3',
      'blockquote',
      'figure',
      'figcaption',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          src: attribs.src || '',
          alt: attribs.alt || '',
          loading: 'lazy',
        },
      }),
    },
  }).trim()

const makeSlug = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeThumbnailUrl = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^data:image\//i.test(normalized)) {
    throw new HttpError(
      'Ảnh phải được tải lên Storage, không lưu trực tiếp dạng Base64',
      400,
    )
  }

  if (!/^https?:\/\//i.test(normalized)) {
    throw new HttpError('Đường dẫn ảnh tin tức không hợp lệ', 400)
  }

  if (normalized.length > 5000) {
    throw new HttpError('Đường dẫn ảnh tin tức quá dài', 400)
  }

  return normalized
}

const normalizeNewsInput = (payload = {}) => {
  const title = payload.title === undefined
    ? undefined
    : cleanPlainText(payload.title)
  const summary = payload.summary === undefined
    ? undefined
    : cleanPlainText(payload.summary)
  const content = payload.content === undefined
    ? undefined
    : cleanContent(payload.content)
  const slugSource = payload.slug || title
  const slug = slugSource === undefined ? undefined : makeSlug(slugSource)
  const thumbnailUrl = normalizeThumbnailUrl(payload.thumbnailUrl)

  if (title !== undefined && !title) {
    throw new HttpError('Tiêu đề tin tức không hợp lệ', 400)
  }
  if (content !== undefined && !cleanPlainText(content)) {
    throw new HttpError('Nội dung tin tức phải có phần chữ', 400)
  }
  if (slug !== undefined && !slug) {
    throw new HttpError('Slug tin tức không hợp lệ', 400)
  }

  return { title, summary, content, slug, thumbnailUrl }
}

const ensureUniqueSlug = async (slug, excludeId = null) => {
  const duplicate = await prisma.news.findFirst({
    where: {
      slug,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Slug tin tức đã tồn tại', 409)
  }
}

const buildNewsWhere = (query = {}, publicOnly = false) => {
  const conditions = []

  if (publicOnly) {
    conditions.push(
      { status: { in: ['PUBLISHED', 'ACTIVE'] } },
      {
        OR: [
          { publishedAt: null },
          { publishedAt: { lte: new Date() } },
        ],
      },
    )
  } else if (query.status) {
    conditions.push({ status: query.status })
  }

  if (query.keyword) {
    const keyword = normalizeWhitespace(query.keyword)
    if (keyword) {
      conditions.push({
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { summary: { contains: keyword, mode: 'insensitive' } },
          { slug: { contains: keyword, mode: 'insensitive' } },
        ],
      })
    }
  }

  return {
    deletedAt: null,
    ...(conditions.length ? { AND: conditions } : {}),
  }
}

const extractContentImageUrls = (content) => {
  const urls = new Set()
  const html = String(content || '')
  const regex = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    const url = String(match[2] || '').trim()
    if (/^https?:\/\//i.test(url)) urls.add(url)
  }

  return urls
}

const collectReferencedImageUrls = (news) => {
  const urls = extractContentImageUrls(news?.content)
  if (news?.thumbnailUrl) urls.add(news.thumbnailUrl)
  return urls
}

const listNews = async (query = {}, { publicOnly = false } = {}) => {
  const { page, limit, skip } = parsePagination(query)
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50)
  const where = buildNewsWhere(query, publicOnly)

  // Chạy tuần tự để tránh timeout connection/transaction trên Supabase.
  const news = await prisma.news.findMany({
    where,
    select: newsListSelect,
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip,
    take: safeLimit,
  })

  const total = await prisma.news.count({ where })

  return {
    news,
    pagination: buildPagination(total, page, safeLimit),
  }
}

const getNewsById = async (newsId) => {
  const news = await prisma.news.findFirst({
    where: { id: newsId, deletedAt: null },
    select: newsDetailSelect,
  })

  if (!news) throw new HttpError('Không tìm thấy tin tức', 404)
  return news
}

const getPublicNewsById = async (newsId) => {
  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      deletedAt: null,
      status: { in: ['PUBLISHED', 'ACTIVE'] },
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: new Date() } },
      ],
    },
    select: newsDetailSelect,
  })

  if (!news) throw new HttpError('Không tìm thấy tin tức', 404)

  const updated = await prisma.news.update({
    where: { id: newsId },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  })

  return { ...news, viewCount: updated.viewCount }
}

const createNews = async (payload, actor) => {
  const normalized = normalizeNewsInput(payload)

  if (!normalized.title) throw new HttpError('Tiêu đề tin tức là bắt buộc', 400)
  if (!normalized.content) throw new HttpError('Nội dung tin tức là bắt buộc', 400)
  if (!normalized.slug) throw new HttpError('Slug tin tức không hợp lệ', 400)

  await ensureUniqueSlug(normalized.slug)

  const status = NEWS_STATUSES.includes(payload.status)
    ? payload.status
    : 'DRAFT'

  return prisma.$transaction(
    async (transaction) => {
      const news = await transaction.news.create({
        data: {
          title: normalized.title,
          slug: normalized.slug,
          summary: normalized.summary || '',
          content: normalized.content,
          thumbnailUrl: normalized.thumbnailUrl ?? null,
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          createdById: actor.id,
        },
        select: newsDetailSelect,
      })

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: 'CREATE_NEWS',
          entityType: 'NEWS',
          entityId: news.id,
          description: `Tạo tin tức: ${news.title}`,
        },
        transaction,
      )

      return news
    },
    { maxWait: 10000, timeout: 30000 },
  )
}

const updateNews = async (newsId, payload, actor) => {
  const existing = await getNewsById(newsId)
  const normalized = normalizeNewsInput(payload)

  if (normalized.slug && normalized.slug !== existing.slug) {
    await ensureUniqueSlug(normalized.slug, newsId)
  }

  const nextStatus = payload.status && NEWS_STATUSES.includes(payload.status)
    ? payload.status
    : existing.status

  const news = await prisma.$transaction(
    async (transaction) => {
      const updated = await transaction.news.update({
        where: { id: newsId },
        data: {
          ...(normalized.title !== undefined && { title: normalized.title }),
          ...(normalized.slug !== undefined && { slug: normalized.slug }),
          ...(normalized.summary !== undefined && { summary: normalized.summary }),
          ...(normalized.content !== undefined && { content: normalized.content }),
          ...(normalized.thumbnailUrl !== undefined && {
            thumbnailUrl: normalized.thumbnailUrl,
          }),
          ...(payload.status && NEWS_STATUSES.includes(payload.status) && {
            status: payload.status,
          }),
          ...(nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' && {
            publishedAt: new Date(),
          }),
          updatedById: actor.id,
        },
        select: newsDetailSelect,
      })

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: 'UPDATE_NEWS',
          entityType: 'NEWS',
          entityId: newsId,
          description: `Cập nhật tin tức: ${updated.title}`,
        },
        transaction,
      )

      return updated
    },
    { maxWait: 10000, timeout: 30000 },
  )

  // Chỉ xóa các ảnh Storage không còn được bài viết tham chiếu sau khi DB đã lưu thành công.
  const oldImages = collectReferencedImageUrls(existing)
  const newImages = collectReferencedImageUrls(news)

  for (const url of oldImages) {
    if (newImages.has(url)) continue

    try {
      await deleteManagedNewsImageByUrl(url)
    } catch (error) {
      console.warn(`Không thể dọn ảnh tin tức cũ: ${error.message}`)
    }
  }

  return news
}

const changeNewsStatus = async (newsId, status, actor) => {
  if (!NEWS_STATUSES.includes(status)) {
    throw new HttpError('Trạng thái tin tức không hợp lệ', 400)
  }

  const existing = await getNewsById(newsId)

  return prisma.$transaction(
    async (transaction) => {
      const news = await transaction.news.update({
        where: { id: newsId },
        data: {
          status,
          ...(status === 'PUBLISHED' && existing.status !== 'PUBLISHED' && {
            publishedAt: new Date(),
          }),
          updatedById: actor.id,
        },
        select: newsDetailSelect,
      })

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: status === 'PUBLISHED' ? 'PUBLISH_NEWS' : 'CHANGE_NEWS_STATUS',
          entityType: 'NEWS',
          entityId: newsId,
          description: `Chuyển trạng thái tin tức sang ${status}`,
        },
        transaction,
      )

      return news
    },
    { maxWait: 10000, timeout: 30000 },
  )
}

const softDeleteNews = async (newsId, actor) => {
  const existing = await getNewsById(newsId)

  return prisma.$transaction(
    async (transaction) => {
      const news = await transaction.news.update({
        where: { id: newsId },
        data: {
          status: 'INACTIVE',
          deletedAt: new Date(),
          updatedById: actor.id,
        },
        select: newsDetailSelect,
      })

      await writeAuditLog(
        {
          userId: actor.id,
          role: actor.role,
          action: 'DELETE_NEWS',
          entityType: 'NEWS',
          entityId: newsId,
          description: `Xóa mềm tin tức: ${existing.title}`,
        },
        transaction,
      )

      return news
    },
    { maxWait: 10000, timeout: 30000 },
  )
}

export {
  NEWS_STATUSES,
  changeNewsStatus,
  cleanContent,
  createNews,
  getNewsById,
  getPublicNewsById,
  listNews,
  makeSlug,
  softDeleteNews,
  updateNews,
}
