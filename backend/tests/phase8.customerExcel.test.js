import {
  buildCustomerRows,
  createCustomerExcelWorkbook,
} from '../src/services/customerExcel.service.js'

describe('Giai đoạn 8 - xuất Excel khách hàng', () => {
  const sample = [{
    id: '12345678-1234-1234-1234-123456789012',
    fullName: 'Nguyễn Văn A',
    phone: '0912345678',
    email: 'a@example.com',
    classification: 'VIP',
    successfulBookings: 11,
    violations: { count: 1, label: 'Bình thường' },
    totalSpent: 5500000,
    favoriteRoute: 'Đắk Lắk → TP.HCM',
    lastBookingAt: '2026-08-10T10:00:00+07:00',
    status: 'ACTIVE',
  }]

  test('giữ đúng 12 cột quản lý khách hàng của MVC', () => {
    const rows = buildCustomerRows(sample)
    expect(rows[0]).toHaveLength(12)
    expect(rows[1]).toContain('Nguyễn Văn A')
    expect(rows[1]).toContain('VIP')
    expect(rows[1]).toContain(5500000)
  })

  test('tạo workbook XLSX thật', () => {
    const workbook = createCustomerExcelWorkbook(sample)
    expect(Buffer.isBuffer(workbook)).toBe(true)
    expect(workbook.subarray(0, 2).toString()).toBe('PK')
    expect(workbook.toString('utf8')).toContain('')
  })
})
