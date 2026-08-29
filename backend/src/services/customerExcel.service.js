import { deflateRawSync } from 'node:zlib'

const CLASSIFICATION_LABELS = Object.freeze({
  VIP: 'VIP',
  REGULAR: 'Thường xuyên',
  NEW: 'Mới',
})

const STATUS_LABELS = Object.freeze({
  ACTIVE: 'Hoạt động',
  BLOCKED: 'Đã khóa',
  ARCHIVED: 'Lưu trữ',
})

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const zipFiles = (files) => {
  const localParts = []
  const centralParts = []
  let offset = 0
  const now = new Date()
  const year = Math.max(1980, now.getFullYear())
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  for (const file of files) {
    const name = Buffer.from(file.name)
    const source = Buffer.from(file.data, 'utf8')
    const compressed = deflateRawSync(source)
    const checksum = crc32(source)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(source.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localParts.push(Buffer.concat([localHeader, name, compressed]))

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(source.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(Buffer.concat([centralHeader, name]))
    offset += 30 + name.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, centralDirectory, end])
}

const escapeXml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;')

const columnName = (index) => {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

const cellXml = (value, row, col) => {
  const ref = `${columnName(col)}${row + 1}`
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : ''

const buildCustomerRows = (customers) => [
  ['Mã khách hàng', 'Họ tên', 'Số điện thoại', 'Email', 'Phân loại', 'Số vé thành công', 'Số lần hủy/không đi', 'Mức độ rủi ro', 'Tổng chi tiêu', 'Tuyến thường đi', 'Lần đặt gần nhất', 'Trạng thái'],
  ...customers.map((customer) => [
    String(customer.id || '').slice(0, 8).toUpperCase(),
    customer.fullName || '',
    customer.phone || '',
    customer.email || '',
    CLASSIFICATION_LABELS[customer.classification] || customer.classification || '',
    Number(customer.successfulBookings || 0),
    Number(customer.violations?.count || 0),
    customer.violations?.label || 'Bình thường',
    Number(customer.totalSpent || 0),
    customer.favoriteRoute || '-',
    formatDate(customer.lastBookingAt),
    STATUS_LABELS[customer.status] || customer.status || '',
  ]),
]

const createCustomerExcelWorkbook = (customers) => {
  const rows = buildCustomerRows(customers)
  const sheetData = rows.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cellXml(value, rowIndex, columnIndex)).join('')}</row>`,
  ).join('')
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`

  return zipFiles([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Danh sách khách hàng" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ])
}

export { buildCustomerRows, createCustomerExcelWorkbook }
