import {
  formatLicensePlate,
  formatVietnamesePhone,
  isValidFullName,
  isVietnameseLicensePlate,
  isVietnamesePhone,
  normalizeBookingCode,
  normalizeEmail,
  normalizeFullName,
  normalizeLicensePlate,
  normalizeLocationName,
  normalizePhone,
  normalizeProvince,
  normalizeRouteName,
} from '../src/utils/normalize.js'

describe('Chuẩn hóa dữ liệu dùng chung', () => {
  test('chuẩn hóa và định dạng biển số XXY-XXX.XX', () => {
    expect(normalizeLicensePlate(' 47b-123.45 ')).toBe('47B12345')
    expect(formatLicensePlate('47b12345')).toBe('47B-123.45')
    expect(isVietnameseLicensePlate('47B-123.45')).toBe(true)
    expect(isVietnameseLicensePlate('47BB-123.45')).toBe(false)
  })

  test('chuẩn hóa số điện thoại Việt Nam về đầu 0', () => {
    expect(normalizePhone('+84 912.345.678')).toBe('0912345678')
    expect(normalizePhone('84-912-345-678')).toBe('0912345678')
    expect(formatVietnamesePhone('0912345678')).toBe('0912 345 678')
    expect(isVietnamesePhone('0912-345-678')).toBe(true)
    expect(isVietnamesePhone('0212345678')).toBe(false)
  })

  test('chuẩn hóa email, họ tên và mã vé', () => {
    expect(normalizeEmail('  ANH@GMAIL.COM ')).toBe('anh@gmail.com')
    expect(normalizeFullName(' Nguyễn   Văn  An ')).toBe('Nguyễn Văn An')
    expect(isValidFullName('Nguyễn Văn An')).toBe(true)
    expect(normalizeBookingCode(' tn - 001 ')).toBe('TN-001')
  })

  test('chuẩn hóa địa điểm theo dữ liệu Nhà xe Thành Nhân', () => {
    expect(normalizeProvince('Thành phố Hồ Chí Minh')).toBe('TP.HCM')
    expect(normalizeProvince('dak lak')).toBe('Đắk Lắk')
    expect(normalizeLocationName('Trơn Thành')).toBe('Chơn Thành')
    expect(normalizeLocationName('EA Tân')).toBe('Ea Tân')
    expect(normalizeRouteName('Krông Năng->TP.HCM')).toBe('Krông Năng → TP.HCM')
  })
})
