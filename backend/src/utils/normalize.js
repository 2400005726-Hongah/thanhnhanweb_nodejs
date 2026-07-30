const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const normalizeFullName = (fullName) =>
  String(fullName || '')
    .trim()
    .replace(/\s+/g, ' ')

const normalizePhone = (phone) => {
  let normalized = String(phone || '')
    .trim()
    .replace(/[\s().-]/g, '')

  if (normalized.startsWith('+84')) {
    normalized = `0${normalized.slice(3)}`
  } else if (normalized.startsWith('84') && normalized.length === 11) {
    normalized = `0${normalized.slice(2)}`
  }

  return normalized
}

const isVietnamesePhone = (phone) =>
  /^0(?:3|5|7|8|9)[0-9]{8}$/.test(normalizePhone(phone))

const normalizeLicensePlate = (licensePlate) =>
  String(licensePlate || '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')

export {
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizeLicensePlate,
  normalizePhone,
}
