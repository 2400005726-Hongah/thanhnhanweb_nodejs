import { buildBookingRows, createBookingExcelWorkbook } from '../src/services/bookingExcel.service.js'

describe('Giai đoạn 7B - Xuất Excel danh sách vé', () => {
  const booking = {
    bookingCode: 'TNABCDEF1234567890',
    source: 'ONLINE',
    passengerFullName: 'Nguyễn Văn A',
    passengerPhone: '0912345678',
    totalAmount: 450000,
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    createdAt: new Date('2099-07-20T08:00:00.000Z'),
    trip: {
      departureTime: new Date('2099-07-20T12:00:00.000Z'),
      route: { routeName: 'Đắk Lắk → TP.HCM' },
    },
    items: [{ seatCode: 'A01' }],
    payments: [
      {
        transactionCode: 'PAY001',
        paymentMethod: 'BANK_TRANSFER',
      },
    ],
  }

  test('xuất đúng 13 cột như bản MVC', () => {
    const rows = buildBookingRows([booking])

    expect(rows[0]).toEqual([
      'Mã vé',
      'Mã giao dịch',
      'Nguồn đặt',
      'Khách hàng',
      'Số điện thoại',
      'Hành trình',
      'Ghế',
      'Ngày đặt',
      'Giờ xuất bến',
      'Tổng tiền',
      'Trạng thái vé',
      'Thanh toán',
      'Phương thức',
    ])

    expect(rows[1]).toEqual(
      expect.arrayContaining([
        'TNABCDEF1234567890',
        'PAY001',
        'Trực tuyến',
        'Nguyễn Văn A',
        'Đắk Lắk → TP.HCM',
        'A01',
        450000,
        'Đã đặt',
        'Đã thanh toán',
        'Chuyển khoản ngân hàng',
      ]),
    )
  })

  test('tạo file XLSX ZIP hợp lệ ở mức cấu trúc', () => {
    const workbook = createBookingExcelWorkbook([booking])

    expect(Buffer.isBuffer(workbook)).toBe(true)
    expect(workbook.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(workbook.includes(Buffer.from('xl/workbook.xml'))).toBe(true)
    expect(workbook.includes(Buffer.from('xl/worksheets/sheet1.xml'))).toBe(true)
  })
})
