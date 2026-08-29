const normalizeWhitespace = (value) =>
  String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeFullName = (value) => normalizeWhitespace(value)

const isValidFullName = (value) => {
  const normalized = normalizeFullName(value)
  const letters = normalized.match(/\p{L}/gu) || []
  return (
    normalized.length >= 2 &&
    normalized.length <= 100 &&
    letters.length >= 2 &&
    /^[\p{L}][\p{L}\s.'’\-]*$/u.test(normalized)
  )
}

const normalizeEmail = (value) => normalizeWhitespace(value).toLowerCase()

const normalizePhone = (value) => {
  const raw = String(value || '').trim()
  let normalized = raw.replace(/[^0-9+]/g, '')

  if (normalized.startsWith('+84')) {
    normalized = `0${normalized.slice(3)}`
  } else {
    normalized = normalized.replace(/\+/g, '')
    if (normalized.startsWith('84') && normalized.length === 11) {
      normalized = `0${normalized.slice(2)}`
    }
  }

  return normalized.replace(/\D/g, '').slice(0, 10)
}

const isVietnamesePhone = (value) =>
  /^0(?:3|5|7|8|9)\d{8}$/.test(normalizePhone(value))

const formatPhoneInput = (value) => {
  const phone = normalizePhone(value)

  // Khi người dùng đang gõ, không tự chèn khoảng trắng giữa chừng.
  // Việc thay đổi độ dài value ở mỗi phím khiến caret của controlled input
  // bị nhảy sang vị trí khác và tạo cảm giác nhập lặp/nhảy số.
  if (phone.length < 10) return phone

  return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7, 10)}`
}

const normalizeLicensePlate = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 8)

const isVietnameseLicensePlate = (value) =>
  /^\d{2}[A-Z]\d{5}$/.test(normalizeLicensePlate(value))

const formatLicensePlate = (value) => {
  const plate = normalizeLicensePlate(value)

  // Không tự chèn '-' / '.' trong lúc người dùng chưa nhập đủ biển số.
  // Giữ value ổn định để con trỏ không bị React đẩy sang vị trí khác.
  if (plate.length < 8) return plate

  return `${plate.slice(0, 3)}-${plate.slice(3, 6)}.${plate.slice(6, 8)}`
}


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

const normalizeProvince = (value) => {
  const normalized = normalizeWhitespace(value)
  return PROVINCE_ALIASES.get(normalizeComparisonKey(normalized)) || normalized
}

const normalizeLocationName = (value) => {
  const normalized = normalizeWhitespace(value)
  return LOCATION_ALIASES.get(normalizeComparisonKey(normalized)) || normalized
}

const normalizeAddress = (value) => normalizeWhitespace(value)

const normalizeRouteName = (value) =>
  normalizeWhitespace(value).replace(/\s*(?:->|→|–|—)\s*/g, ' → ')

const normalizeBookingCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^#/, '')

const formatBookingCode = (value) => {
  const normalized = normalizeBookingCode(value)
  return /^\d{4}$/.test(normalized) ? `#${normalized}` : normalized
}

const normalizeTicketLookupIdentifier = (value) =>
  normalizeBookingCode(value)

const normalizeMoneyInput = (value) => String(value || '').replace(/\D/g, '')

const parseMoneyInput = (value) => {
  const normalized = normalizeMoneyInput(value)
  return normalized ? Number(normalized) : null
}

const normalizeMultilineText = (value) =>
  String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[\t ]+/g, ' '))
    .filter(Boolean)
    .join('\n')

export {
  removeVietnameseAccents,
  normalizeRouteName,
  normalizeProvince,
  normalizeLocationName,
  normalizeComparisonKey,
  normalizeAddress,
  formatLicensePlate,
  formatPhoneInput,
  isValidFullName,
  isVietnameseLicensePlate,
  isVietnamesePhone,
  formatBookingCode,
  normalizeBookingCode,
  normalizeTicketLookupIdentifier,
  normalizeEmail,
  normalizeFullName,
  normalizeLicensePlate,
  normalizeMoneyInput,
  normalizeMultilineText,
  normalizePhone,
  normalizeWhitespace,
  parseMoneyInput,
}
