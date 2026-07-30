const parsePagination = (query, defaultLimit = 10) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1)
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1),
    100,
  )

  return { page, limit, skip: (page - 1) * limit }
}

const buildPagination = (total, page, limit) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
})

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')

export { buildPagination, escapeRegex, normalizeText, parsePagination }

