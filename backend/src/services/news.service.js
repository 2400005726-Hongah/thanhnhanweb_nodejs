import sanitizeHtml from 'sanitize-html'

import prisma from '../config/prisma.js'
import HttpError from '../utils/HttpError.js'
import { buildPagination, parsePagination } from '../utils/query.js'
import { writeAuditLog } from './auditLog.service.js'

const NEWS_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT', 'PUBLISHED']

const authorSelect = {
  id: true,
  fullName: true,
  role: true,
}

const newsInclude = {
  createdBy: { select: authorSelect },
  updatedBy: { select: authorSelect },
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
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
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

const ensureUniqueSlug = async (slug, excludeId = null) => {
  const duplicate = await prisma.news.findFirst({
    where: {
      slug,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true },
  })

  if (duplicate) {
    throw new HttpError('Slug tin tức đã tồn tại', 409)
  }
}

const normalizeNewsInput = (payload) => {
  const title = payload.title === undefined ? undefined : cleanPlainText(payload.title)
  const summary =
    payload.summary === undefined ? undefined : cleanPlainText(payload.summary)
  const content =
    payload.content === undefined ? undefined : cleanContent(payload.content)
  const slugSource = payload.slug || title
  const slug = slugSource === undefined ? undefined : makeSlug(slugSource)

  if (title !== undefined && !title) {
    throw new HttpError('Tiêu đề tin tức không hợp lệ', 400)
  }
  if (content !== undefined && !cleanPlainText(content)) {
    throw new HttpError('Nội dung tin tức không hợp lệ', 400)
  }
  if (slug !== undefined && !slug) {
    throw new HttpError('Slug tin tức không hợp lệ', 400)
  }

  return { title, summary, content, slug }
}

const listNews = async (query, { publicOnly = false } = {}) => {
  const { page, limit, skip } = parsePagination(query)
  const where = {
    ...(publicOnly
      ? { status: 'PUBLISHED', publishedAt: { lte: new Date() } }
      : query.status && { status: query.status }),
    ...(query.keyword && {
      OR: ['title', 'summary', 'slug'].map((field) => ({
        [field]: { contains: query.keyword.trim(), mode: 'insensitive' },
      })),
    }),
  }

  const [news, total] = await Promise.all([
    prisma.news.findMany({
      where,
      include: newsInclude,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.news.count({ where }),
  ])

  return { news, pagination: buildPagination(total, page, limit) }
}

const getNewsById = async (newsId) => {
  const news = await prisma.news.findUnique({
    where: { id: newsId },
    include: newsInclude,
  })

  if (!news) {
    throw new HttpError('Không tìm thấy tin tức', 404)
  }
  return news
}

const createNews = async (payload, actor) => {
  const normalized = normalizeNewsInput(payload)
  await ensureUniqueSlug(normalized.slug)

  return prisma.$transaction(async (transaction) => {
    const news = await transaction.news.create({
      data: {
        ...normalized,
        summary: normalized.summary || '',
        thumbnailUrl: payload.thumbnailUrl || null,
        status: payload.status || 'DRAFT',
        publishedAt:
          (payload.status || 'DRAFT') === 'PUBLISHED' ? new Date() : null,
        createdById: actor.id,
      },
      include: newsInclude,
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
  })
}

const updateNews = async (newsId, payload, actor) => {
  const existing = await getNewsById(newsId)
  const normalized = normalizeNewsInput(payload)

  if (normalized.slug && normalized.slug !== existing.slug) {
    await ensureUniqueSlug(normalized.slug, newsId)
  }

  const nextStatus = payload.status || existing.status
  return prisma.$transaction(async (transaction) => {
    const news = await transaction.news.update({
      where: { id: newsId },
      data: {
        ...(normalized.title !== undefined && { title: normalized.title }),
        ...(normalized.slug !== undefined && { slug: normalized.slug }),
        ...(normalized.summary !== undefined && { summary: normalized.summary }),
        ...(normalized.content !== undefined && { content: normalized.content }),
        ...(payload.thumbnailUrl !== undefined && {
          thumbnailUrl: payload.thumbnailUrl || null,
        }),
        ...(payload.status && { status: payload.status }),
        ...(nextStatus === 'PUBLISHED' &&
          existing.status !== 'PUBLISHED' && { publishedAt: new Date() }),
        updatedById: actor.id,
      },
      include: newsInclude,
    })

    await writeAuditLog(
      {
        userId: actor.id,
        role: actor.role,
        action: 'UPDATE_NEWS',
        entityType: 'NEWS',
        entityId: newsId,
        description: `Cập nhật tin tức: ${news.title}`,
      },
      transaction,
    )
    return news
  })
}

const changeNewsStatus = async (newsId, status, actor) => {
  const existing = await getNewsById(newsId)

  return prisma.$transaction(async (transaction) => {
    const news = await transaction.news.update({
      where: { id: newsId },
      data: {
        status,
        ...(status === 'PUBLISHED' &&
          existing.status !== 'PUBLISHED' && { publishedAt: new Date() }),
        updatedById: actor.id,
      },
      include: newsInclude,
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
  })
}

const softDeleteNews = (newsId, actor) =>
  changeNewsStatus(newsId, 'INACTIVE', actor)

export {
  NEWS_STATUSES,
  changeNewsStatus,
  cleanContent,
  createNews,
  getNewsById,
  listNews,
  makeSlug,
  softDeleteNews,
  updateNews,
}
