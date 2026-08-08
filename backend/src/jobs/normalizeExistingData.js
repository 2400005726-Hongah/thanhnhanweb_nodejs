import prisma from '../config/prisma.js'
import {
  isValidFullName,
  isVietnameseLicensePlate,
  isVietnamesePhone,
  normalizeAddress,
  normalizeBookingCode,
  normalizeEmail,
  normalizeFullName,
  normalizeLicensePlate,
  normalizeLocationName,
  normalizeMultilineText,
  normalizePhone,
  normalizeProvince,
  normalizeRouteName,
  normalizeWhitespace,
} from '../utils/normalize.js'

const applyChanges = process.argv.includes('--apply')
const sampleLimit = 8

const nullable = (value, normalizer) => {
  if (value === undefined || value === null || value === '') return null
  const normalized = normalizer(value)
  return normalized || null
}

const changed = (before, after) => (before ?? null) !== (after ?? null)

const rowChanged = (before, after, fields) =>
  fields.some((field) => changed(before[field], after[field]))

const buildChange = (entity, id, field, before, after) => ({
  entity,
  id,
  field,
  before,
  after,
})

const findDuplicateGroups = (rows, keyBuilder, labelBuilder) => {
  const groups = new Map()

  for (const row of rows) {
    const key = keyBuilder(row)
    if (!key) continue
    const current = groups.get(key) || []
    current.push(row)
    groups.set(key, current)
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      records: group.map(labelBuilder),
    }))
}

const validateNormalizedRows = ({
  users,
  customers,
  buses,
  locations,
  bookings,
}) => {
  const errors = []

  for (const user of users) {
    if (!isValidFullName(user.fullName)) {
      errors.push(`Tài khoản ${user.id}: họ tên không hợp lệ sau chuẩn hóa`)
    }
    if (!isVietnamesePhone(user.phone)) {
      errors.push(`Tài khoản ${user.id}: số điện thoại không hợp lệ sau chuẩn hóa`)
    }
    if (!user.email) {
      errors.push(`Tài khoản ${user.id}: email trống sau chuẩn hóa`)
    }
  }

  for (const customer of customers) {
    if (!isValidFullName(customer.fullName)) {
      errors.push(`Khách hàng ${customer.id}: họ tên không hợp lệ sau chuẩn hóa`)
    }
    if (!isVietnamesePhone(customer.phone)) {
      errors.push(`Khách hàng ${customer.id}: số điện thoại không hợp lệ sau chuẩn hóa`)
    }
  }

  for (const bus of buses) {
    if (!isVietnameseLicensePlate(bus.licensePlate)) {
      errors.push(`Xe ${bus.id}: biển số không đúng dạng XXY-XXX.XX`)
    }
  }

  for (const location of locations) {
    if (!location.name || !location.province) {
      errors.push(`Địa điểm ${location.id}: tên hoặc tỉnh/thành bị trống`)
    }
  }

  for (const booking of bookings) {
    if (!booking.bookingCode) {
      errors.push(`Vé ${booking.id}: mã vé bị trống`)
    }
    if (!isValidFullName(booking.passengerFullName)) {
      errors.push(`Vé ${booking.id}: họ tên hành khách không hợp lệ`)
    }
    if (!isVietnamesePhone(booking.passengerPhone)) {
      errors.push(`Vé ${booking.id}: số điện thoại hành khách không hợp lệ`)
    }
  }

  return errors
}

const main = async () => {
  const [
    usersRaw,
    customersRaw,
    busesRaw,
    locationsRaw,
    routesRaw,
    bookingsRaw,
    paymentsRaw,
    newsRaw,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.customer.findMany(),
    prisma.bus.findMany(),
    prisma.location.findMany(),
    prisma.route.findMany(),
    prisma.booking.findMany(),
    prisma.payment.findMany(),
    prisma.news.findMany(),
  ])

  const users = usersRaw.map((row) => ({
    ...row,
    fullName: normalizeFullName(row.fullName),
    email: normalizeEmail(row.email),
    phone: normalizePhone(row.phone),
  }))

  const customers = customersRaw.map((row) => ({
    ...row,
    fullName: normalizeFullName(row.fullName),
    phone: normalizePhone(row.phone),
    email: nullable(row.email, normalizeEmail),
    blockedReason: nullable(row.blockedReason, normalizeWhitespace),
  }))

  const buses = busesRaw.map((row) => ({
    ...row,
    busName: normalizeWhitespace(row.busName),
    licensePlate: normalizeLicensePlate(row.licensePlate),
  }))

  const locations = locationsRaw.map((row) => ({
    ...row,
    name: normalizeLocationName(row.name),
    province: normalizeProvince(row.province),
    address: normalizeAddress(row.address),
  }))

  const routes = routesRaw.map((row) => ({
    ...row,
    routeName: normalizeRouteName(row.routeName),
  }))

  const bookings = bookingsRaw.map((row) => ({
    ...row,
    bookingCode: normalizeBookingCode(row.bookingCode),
    passengerFullName: normalizeFullName(row.passengerFullName),
    passengerPhone: normalizePhone(row.passengerPhone),
    passengerEmail: nullable(row.passengerEmail, normalizeEmail),
    customerNote: nullable(row.customerNote, normalizeMultilineText),
    staffNote: nullable(row.staffNote, normalizeMultilineText),
    pickupPoint: nullable(row.pickupPoint, normalizeMultilineText),
    dropoffPoint: nullable(row.dropoffPoint, normalizeMultilineText),
    cancellationReason: nullable(row.cancellationReason, normalizeWhitespace),
    noShowReason: nullable(row.noShowReason, normalizeWhitespace),
    deletedReason: nullable(row.deletedReason, normalizeWhitespace),
  }))

  const payments = paymentsRaw.map((row) => ({
    ...row,
    transactionCode: nullable(row.transactionCode, normalizeBookingCode),
  }))

  const news = newsRaw.map((row) => ({
    ...row,
    title: normalizeWhitespace(row.title),
    summary: normalizeWhitespace(row.summary),
    content: normalizeMultilineText(row.content),
    thumbnailUrl: nullable(row.thumbnailUrl, normalizeWhitespace),
  }))

  const conflicts = {
    userEmails: findDuplicateGroups(
      users,
      (row) => row.email,
      (row) => ({ id: row.id, email: row.email }),
    ),
    userPhones: findDuplicateGroups(
      users,
      (row) => row.phone,
      (row) => ({ id: row.id, phone: row.phone }),
    ),
    customerPhones: findDuplicateGroups(
      customers,
      (row) => row.phone,
      (row) => ({ id: row.id, phone: row.phone }),
    ),
    licensePlates: findDuplicateGroups(
      buses,
      (row) => row.licensePlate,
      (row) => ({ id: row.id, licensePlate: row.licensePlate }),
    ),
    locations: findDuplicateGroups(
      locations,
      (row) => `${row.name.toLocaleLowerCase('vi-VN')}|${row.province.toLocaleLowerCase('vi-VN')}`,
      (row) => ({ id: row.id, name: row.name, province: row.province }),
    ),
    bookingCodes: findDuplicateGroups(
      bookings,
      (row) => row.bookingCode,
      (row) => ({ id: row.id, bookingCode: row.bookingCode }),
    ),
    transactionCodes: findDuplicateGroups(
      payments,
      (row) => row.transactionCode,
      (row) => ({ id: row.id, transactionCode: row.transactionCode }),
    ),
  }

  const conflictEntries = Object.entries(conflicts).filter(([, value]) => value.length)
  const validationErrors = validateNormalizedRows({
    users,
    customers,
    buses,
    locations,
    bookings,
  })

  const changes = []
  const collect = (entity, before, after, fields) => {
    for (const field of fields) {
      if (changed(before[field], after[field])) {
        changes.push(buildChange(entity, before.id, field, before[field], after[field]))
      }
    }
  }

  users.forEach((row, index) => collect('Tài khoản', usersRaw[index], row, ['fullName', 'email', 'phone']))
  customers.forEach((row, index) => collect('Khách hàng', customersRaw[index], row, ['fullName', 'phone', 'email', 'blockedReason']))
  buses.forEach((row, index) => collect('Xe', busesRaw[index], row, ['busName', 'licensePlate']))
  locations.forEach((row, index) => collect('Địa điểm', locationsRaw[index], row, ['name', 'province', 'address']))
  routes.forEach((row, index) => collect('Tuyến', routesRaw[index], row, ['routeName']))
  bookings.forEach((row, index) => collect('Vé', bookingsRaw[index], row, [
    'bookingCode',
    'passengerFullName',
    'passengerPhone',
    'passengerEmail',
    'customerNote',
    'staffNote',
    'pickupPoint',
    'dropoffPoint',
    'cancellationReason',
    'noShowReason',
    'deletedReason',
  ]))
  payments.forEach((row, index) => collect('Thanh toán', paymentsRaw[index], row, ['transactionCode']))
  news.forEach((row, index) => collect('Tin tức', newsRaw[index], row, ['title', 'summary', 'content', 'thumbnailUrl']))

  console.log('\n=== KIỂM TRA CHUẨN HÓA DỮ LIỆU ===')
  console.log(`Chế độ: ${applyChanges ? 'ÁP DỤNG' : 'CHỈ KIỂM TRA'}`)
  console.log(`Số trường cần cập nhật: ${changes.length}`)

  if (changes.length) {
    console.table(changes.slice(0, sampleLimit))
    if (changes.length > sampleLimit) {
      console.log(`... còn ${changes.length - sampleLimit} thay đổi khác`)
    }
  }

  if (validationErrors.length) {
    console.error('\nDữ liệu không hợp lệ sau chuẩn hóa:')
    validationErrors.forEach((message) => console.error(`- ${message}`))
  }

  if (conflictEntries.length) {
    console.error('\nPhát hiện dữ liệu trùng sau chuẩn hóa:')
    for (const [name, groups] of conflictEntries) {
      console.error(`- ${name}:`)
      console.dir(groups, { depth: null })
    }
  }

  if (validationErrors.length || conflictEntries.length) {
    throw new Error('Không thể áp dụng vì còn dữ liệu sai hoặc xung đột. Hãy xử lý các mục được báo trước.')
  }

  if (!applyChanges) {
    console.log('\nChưa thay đổi Supabase. Chạy `npm run db:normalize:apply` sau khi đã kiểm tra báo cáo.')
    return
  }

  await prisma.$transaction(async (transaction) => {
    for (const [index, row] of users.entries()) {
      if (!rowChanged(usersRaw[index], row, ['fullName', 'email', 'phone'])) continue
      await transaction.user.update({
        where: { id: row.id },
        data: { fullName: row.fullName, email: row.email, phone: row.phone },
      })
    }

    for (const [index, row] of customers.entries()) {
      if (!rowChanged(customersRaw[index], row, ['fullName', 'phone', 'email', 'blockedReason'])) continue
      await transaction.customer.update({
        where: { id: row.id },
        data: {
          fullName: row.fullName,
          phone: row.phone,
          email: row.email,
          blockedReason: row.blockedReason,
        },
      })
    }

    for (const [index, row] of buses.entries()) {
      if (!rowChanged(busesRaw[index], row, ['busName', 'licensePlate'])) continue
      await transaction.bus.update({
        where: { id: row.id },
        data: { busName: row.busName, licensePlate: row.licensePlate },
      })
    }

    for (const [index, row] of locations.entries()) {
      if (!rowChanged(locationsRaw[index], row, ['name', 'province', 'address'])) continue
      await transaction.location.update({
        where: { id: row.id },
        data: { name: row.name, province: row.province, address: row.address },
      })
    }

    for (const [index, row] of routes.entries()) {
      if (!rowChanged(routesRaw[index], row, ['routeName'])) continue
      await transaction.route.update({
        where: { id: row.id },
        data: { routeName: row.routeName },
      })
    }

    for (const [index, row] of bookings.entries()) {
      if (!rowChanged(bookingsRaw[index], row, [
        'bookingCode',
        'passengerFullName',
        'passengerPhone',
        'passengerEmail',
        'customerNote',
        'staffNote',
        'pickupPoint',
        'dropoffPoint',
        'cancellationReason',
        'noShowReason',
        'deletedReason',
      ])) continue
      await transaction.booking.update({
        where: { id: row.id },
        data: {
          bookingCode: row.bookingCode,
          passengerFullName: row.passengerFullName,
          passengerPhone: row.passengerPhone,
          passengerEmail: row.passengerEmail,
          customerNote: row.customerNote,
          staffNote: row.staffNote,
          pickupPoint: row.pickupPoint,
          dropoffPoint: row.dropoffPoint,
          cancellationReason: row.cancellationReason,
          noShowReason: row.noShowReason,
          deletedReason: row.deletedReason,
        },
      })
    }

    for (const [index, row] of payments.entries()) {
      if (!rowChanged(paymentsRaw[index], row, ['transactionCode'])) continue
      await transaction.payment.update({
        where: { id: row.id },
        data: { transactionCode: row.transactionCode },
      })
    }

    for (const [index, row] of news.entries()) {
      if (!rowChanged(newsRaw[index], row, ['title', 'summary', 'content', 'thumbnailUrl'])) continue
      await transaction.news.update({
        where: { id: row.id },
        data: {
          title: row.title,
          summary: row.summary,
          content: row.content,
          thumbnailUrl: row.thumbnailUrl,
        },
      })
    }
  }, {
    maxWait: 10000,
    timeout: 120000,
  })

  console.log(`\nĐã chuẩn hóa thành công ${changes.length} trường dữ liệu.`)
}

main()
  .catch((error) => {
    console.error(`\nLỗi chuẩn hóa: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
