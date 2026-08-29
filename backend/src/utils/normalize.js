const removeControlCharacters = (value) =>
  String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ')

const normalizeWhitespace = (value) =>
  removeControlCharacters(value)
    .trim()
    .replace(/\s+/g, ' ')

const normalizeMultilineText = (value) =>
  removeControlCharacters(value)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[\t ]+/g, ' '))
    .filter(Boolean)
    .join('\n')

const normalizeEmail = (email) =>
  normalizeWhitespace(email).toLowerCase()

const normalizeFullName = (fullName) => normalizeWhitespace(fullName)

const isValidFullName = (fullName) => {
  const normalized = normalizeFullName(fullName)
  const letterCount = (normalized.match(/\p{L}/gu) || []).length

  return (
    normalized.length >= 2 &&
    normalized.length <= 100 &&
    letterCount >= 2 &&
    /^[\p{L}][\p{L}\s.'’\-]*$/u.test(normalized)
  )
}

const normalizePhone = (phone) => {
  const raw = String(phone || '').trim()
  let normalized = raw.replace(/[^0-9+]/g, '')

  if (normalized.startsWith('+84')) {
    normalized = `0${normalized.slice(3)}`
  } else {
    normalized = normalized.replace(/\+/g, '')
    if (normalized.startsWith('84') && normalized.length === 11) {
      normalized = `0${normalized.slice(2)}`
    }
  }

  return normalized.replace(/\D/g, '')
}

const isVietnamesePhone = (phone) =>
  /^0(?:3|5|7|8|9)[0-9]{8}$/.test(normalizePhone(phone))

const formatVietnamesePhone = (phone) => {
  const normalized = normalizePhone(phone)
  return isVietnamesePhone(normalized)
    ? `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`
    : normalized
}

const normalizeLicensePlate = (licensePlate) =>
  String(licensePlate || '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')

const isVietnameseLicensePlate = (licensePlate) =>
  /^[0-9]{2}[A-Z][0-9]{5}$/.test(normalizeLicensePlate(licensePlate))

const formatLicensePlate = (licensePlate) => {
  const normalized = normalizeLicensePlate(licensePlate)
  return isVietnameseLicensePlate(normalized)
    ? `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}.${normalized.slice(6)}`
    : normalized
}


const normalizeMoneyValue = (value) => {
  if (value === undefined || value === null || value === '') return value
  if (typeof value === 'number') return value

  const compact = String(value).trim().replace(/\s+/g, '')
  if (/^\d+$/.test(compact)) return Number(compact)
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(compact)) {
    return Number(compact.replace(/[.,]/g, ''))
  }

  return value
}

const normalizeBookingCode = (bookingCode) =>
  String(bookingCode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^#/, '')

const removeVietnameseAccents = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')

const normalizeComparisonKey = (value) =>
  removeVietnameseAccents(normalizeWhitespace(value))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const PROVINCE_ALIASES = new Map([
  ['tphcm', 'TP.HCM'],
  ['thanhphohochiminh', 'TP.HCM'],
  ['hochiminh', 'TP.HCM'],
  ['saigon', 'TP.HCM'],
  ['daklak', 'Đắk Lắk'],
  ['darlac', 'Đắk Lắk'],
  ['binhduong', 'Bình Dương'],
])

const LOCATION_ALIASES = new Map([
  ['eatan', 'Ea Tân'],
  ['eatoh', 'Ea Tóh'],
  ['eaho', 'Ea Hồ'],
  ['dlieya', 'Dliê Ya'],
  ['thitrankrongnang', 'Thị trấn Krông Năng'],
  ['krongnang', 'Krông Năng'],
  ['buonho', 'Buôn Hồ'],
  ['krongbuk', 'Krông Búk'],
  ['cumgar', 'Cư M’gar'],
  ['buonmathuot', 'Buôn Ma Thuột'],
  ['binhthanh', 'Bình Thạnh'],
  ['govap', 'Gò Vấp'],
  ['phunhuan', 'Phú Nhuận'],
  ['quan1', 'Quận 1'],
  ['quan3', 'Quận 3'],
  ['quan5', 'Quận 5'],
  ['quan6', 'Quận 6'],
  ['quan10', 'Quận 10'],
  ['quan11', 'Quận 11'],
  ['quan12', 'Quận 12'],
  ['tanbinh', 'Tân Bình'],
  ['tanphu', 'Tân Phú'],
  ['thuduc', 'Thủ Đức'],
  ['dian', 'Dĩ An'],
  ['phugiao', 'Phú Giáo'],
  ['tanuyen', 'Tân Uyên'],
  ['thuanan', 'Thuận An'],
  ['chonthanh', 'Chơn Thành'],
  ['tronthanh', 'Chơn Thành'],
])

const normalizeProvince = (province) => {
  const normalized = normalizeWhitespace(province)
  return PROVINCE_ALIASES.get(normalizeComparisonKey(normalized)) || normalized
}

const normalizeLocationName = (name) => {
  const normalized = normalizeWhitespace(name)
  return LOCATION_ALIASES.get(normalizeComparisonKey(normalized)) || normalized
}

const normalizeAddress = (address) => {
  const normalized = normalizeWhitespace(address)
  return normalized || null
}

const normalizeRouteName = (routeName) =>
  normalizeWhitespace(routeName)
    .replace(/\s*(?:->|→|–|—)\s*/g, ' → ')

export {
  formatLicensePlate,
  formatVietnamesePhone,
  isValidFullName,
  isVietnameseLicensePlate,
  isVietnamesePhone,
  normalizeAddress,
  normalizeBookingCode,
  normalizeComparisonKey,
  normalizeEmail,
  normalizeFullName,
  normalizeLicensePlate,
  normalizeLocationName,
  normalizeMoneyValue,
  normalizeMultilineText,
  normalizePhone,
  normalizeProvince,
  normalizeRouteName,
  normalizeWhitespace,
  removeVietnameseAccents,
}
