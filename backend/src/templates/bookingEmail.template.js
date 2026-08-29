import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../config/paymentMethods.js'
import { formatLicensePlate, formatVietnamesePhone } from '../utils/normalize.js'

const BUS_TYPE_LABELS = {
  SLEEPER_34: 'Giường nằm 34 giường',
  LIMOUSINE_22: 'Limousine 22 phòng',
  SLEEPER: 'Giường nằm',
  LIMOUSINE: 'Limousine',
  SEATED: 'Ghế ngồi',
}

const SERVICE_MODE_LABELS = {
  TaiVanPhong: 'Tập trung tại văn phòng nhà xe',
  DonTaiBenXe: 'Đón trực tiếp tại bến xe trung tâm',
  DonTaiDiemHen: 'Đón khách tại điểm hẹn',
  TrungChuyenDonKhach: 'Xe trung chuyển đón khách',
  TraTaiBenXe: 'Trả khách tại bến xe trung tâm đích đến',
  TraTaiVanPhong: 'Trả khách tại văn phòng nhà xe',
  TraTaiDiemDung: 'Trả khách tại điểm dừng',
  TrungChuyenTraKhach: 'Xe trung chuyển trả tận nơi khu vực nội thành',
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const formatBookingCode = (value) => {
  const code = String(value || '').trim()
  return /^\d{4}$/.test(code) ? `#${code}` : code
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatVietnamDateTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))

const getPaymentInstruction = (payment) =>
  payment?.paymentMethod === 'PAY_AT_BUS'
    ? 'Vé đã được đặt thành công. Quý khách thanh toán khi lên xe.'
    : payment?.status === 'SUCCESS'
      ? 'Thanh toán đã được ghi nhận.'
      : 'Vui lòng kiểm tra trạng thái thanh toán trước chuyến đi.'

const SOURCE_LABELS = {
  ONLINE: 'Trực tuyến',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}

const getJourneyName = (booking) => {
  if (booking.trip?.route?.routeName) return booking.trip.route.routeName

  const departure =
    booking.trip?.departureLocation?.name ||
    booking.trip?.route?.departureLocation?.name
  const arrival =
    booking.trip?.arrivalLocation?.name ||
    booking.trip?.route?.arrivalLocation?.name

  return departure && arrival
    ? `${departure} → ${arrival}`
    : 'Chưa xác định hành trình'
}

const getBusLabel = (booking) => {
  const bus = booking.trip?.bus || {}
  const typeLabel =
    BUS_TYPE_LABELS[bus.busType] || bus.busType || bus.busName || 'Xe khách'
  const plate = bus.licensePlate ? formatLicensePlate(bus.licensePlate) : ''
  return plate ? `${typeLabel} - ${plate}` : typeLabel
}

const getDefaultPointName = (booking, type) => {
  if (type === 'pickup') {
    return (
      booking.trip?.departureLocation?.name ||
      booking.trip?.route?.departureLocation?.name ||
      'Điểm đón chính của chuyến'
    )
  }

  return (
    booking.trip?.arrivalLocation?.name ||
    booking.trip?.route?.arrivalLocation?.name ||
    'Điểm trả chính của chuyến'
  )
}

const buildBookingEmail = (booking) => {
  const payment = booking.payment
  const paymentMethod =
    PAYMENT_METHOD_LABELS[payment?.paymentMethod] ||
    payment?.paymentMethod ||
    'Chưa chọn'
  const paymentStatus =
    PAYMENT_STATUS_LABELS[booking.paymentStatus] ||
    booking.paymentStatus ||
    'Chưa xác định'
  const seatsText = (booking.seats || [])
    .map((seat) => `${seat.seatCode} (${formatCurrency(seat.price)})`)
    .join(', ')
  const instruction = getPaymentInstruction(payment)

  const pickupMode =
    SERVICE_MODE_LABELS[booking.pickupServiceMode] ||
    booking.pickupServiceMode ||
    null
  const dropoffMode =
    SERVICE_MODE_LABELS[booking.dropoffServiceMode] ||
    booking.dropoffServiceMode ||
    null

  const details = {
    passengerName: booking.passenger?.fullName || 'Chưa cập nhật',
    passengerPhone: formatVietnamesePhone(booking.passenger?.phone || ''),
    bookingCode: formatBookingCode(booking.bookingCode),
    transactionCode: payment?.transactionCode || '—',
    routeName: getJourneyName(booking),
    departureTime: formatVietnamDateTime(booking.trip.departureTime),
    busName: getBusLabel(booking),
    seatsText: seatsText || 'Chưa xác định',
    totalAmount: formatCurrency(booking.totalAmount),
    source: SOURCE_LABELS[booking.source] || 'Chưa xác định',
    pickupPoint: booking.pickupPoint || getDefaultPointName(booking, 'pickup'),
    dropoffPoint: booking.dropoffPoint || getDefaultPointName(booking, 'dropoff'),
    pickupMode,
    dropoffMode,
    paymentMethod,
    paymentStatus,
  }

  const textRows = [
    'NHÀ XE THÀNH NHÂN - VÉ ĐIỆN TỬ',
    `Hành khách: ${details.passengerName}`,
    `Số điện thoại: ${details.passengerPhone}`,
    `Mã vé: ${details.bookingCode}`,
    `Mã giao dịch: ${details.transactionCode}`,
    `Hành trình: ${details.routeName}`,
    `Khởi hành: ${details.departureTime}`,
    `Xe: ${details.busName}`,
    `Ghế/phòng: ${details.seatsText}`,
    `Tổng tiền: ${details.totalAmount}`,
    `Nguồn đặt: ${details.source}`,
    `Điểm đón: ${details.pickupPoint}`,
    ...(details.pickupMode ? [`Hình thức đón: ${details.pickupMode}`] : []),
    `Điểm trả: ${details.dropoffPoint}`,
    ...(details.dropoffMode ? [`Hình thức trả: ${details.dropoffMode}`] : []),
    `Phương thức thanh toán: ${details.paymentMethod}`,
    `Trạng thái thanh toán: ${details.paymentStatus}`,
    instruction,
    'Quý khách vui lòng có mặt trước giờ khởi hành ít nhất 30 phút.',
  ]

  const text = textRows.join('\n')

  const rows = [
    ['Hành khách', details.passengerName],
    ['Số điện thoại', details.passengerPhone],
    ['Mã vé', details.bookingCode],
    ['Mã giao dịch', details.transactionCode],
    ['Hành trình', details.routeName],
    ['Khởi hành', details.departureTime],
    ['Xe', details.busName],
    ['Ghế/phòng', details.seatsText],
    ['Tổng tiền', details.totalAmount],
    ['Nguồn đặt', details.source],
    ['Điểm đón', details.pickupPoint],
    ...(details.pickupMode ? [['Hình thức đón', details.pickupMode]] : []),
    ['Điểm trả', details.dropoffPoint],
    ...(details.dropoffMode ? [['Hình thức trả', details.dropoffMode]] : []),
    ['Phương thức thanh toán', details.paymentMethod],
    ['Trạng thái thanh toán', details.paymentStatus],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#64748b">${escapeHtml(label)}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="vi">
  <head><meta charset="utf-8"><title>Vé điện tử ${escapeHtml(details.bookingCode)}</title></head>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#0f172a">
    <main style="max-width:680px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <header style="background:#73010c;color:#fff;padding:24px">
        <h1 style="margin:0">Nhà xe Thành Nhân</h1>
        <p style="margin:8px 0 0">Vé xe điện tử</p>
      </header>
      <section style="padding:24px">
        <p>Kính chào <strong>${escapeHtml(details.passengerName)}</strong>,</p>
        <p>Vé của quý khách đã được ghi nhận. Thông tin chuyến đi:</p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        <p style="margin-top:20px;padding:14px;background:#fff7ed;border-radius:8px"><strong>${escapeHtml(instruction)}</strong></p>
        <p>Quý khách vui lòng có mặt trước giờ khởi hành ít nhất 30 phút.</p>
      </section>
    </main>
  </body>
</html>`

  return {
    subject: `Vé điện tử ${formatBookingCode(booking.bookingCode)} - Nhà xe Thành Nhân`,
    text,
    html,
  }
}

export {
  buildBookingEmail,
  escapeHtml,
  formatVietnamDateTime,
  getBusLabel,
  getJourneyName,
}
