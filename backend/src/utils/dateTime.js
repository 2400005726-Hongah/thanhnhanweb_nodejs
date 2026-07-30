const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const parseDateParts = (value) => {
  if (!DATE_PATTERN.test(String(value || ''))) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

const isValidDateOnly = (value) => Boolean(parseDateParts(value))
const isValidTimeOnly = (value) => TIME_PATTERN.test(String(value || ''))

const getVietnamDateRange = (value) => {
  const parts = parseDateParts(value)
  if (!parts) return null

  const start = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) - VIETNAM_OFFSET_MS,
  )
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

const getVietnamDateTime = (dateValue, timeValue) => {
  const range = getVietnamDateRange(dateValue)
  if (!range || !isValidTimeOnly(timeValue)) return null

  const [hours, minutes] = timeValue.split(':').map(Number)
  return new Date(range.start.getTime() + (hours * 60 + minutes) * 60 * 1000)
}

const buildFutureVietnamDate = (dayOffset, hour, minute = 0) => {
  const vietnamNow = new Date(Date.now() + VIETNAM_OFFSET_MS)
  return new Date(
    Date.UTC(
      vietnamNow.getUTCFullYear(),
      vietnamNow.getUTCMonth(),
      vietnamNow.getUTCDate() + dayOffset,
      hour,
      minute,
    ) - VIETNAM_OFFSET_MS,
  )
}

export {
  buildFutureVietnamDate,
  getVietnamDateRange,
  getVietnamDateTime,
  isValidDateOnly,
  isValidTimeOnly,
}
