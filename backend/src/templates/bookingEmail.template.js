import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../config/paymentMethods.js'
import { formatLicensePlate, formatVietnamesePhone } from '../utils/normalize.js'

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))

const formatVietnamDateTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))

const getPaymentInstruction = (payment) =>
  payment?.paymentMethod === 'PAY_AT_BUS'
    ? 'Vé đã được giữ chỗ. Quý khách thanh toán khi lên xe.'
    : payment?.status === 'SUCCESS'
      ? 'Thanh toán đã được ghi nhận.'
      : 'Vui lòng kiểm tra trạng thái thanh toán trước chuyến đi.'

const SOURCE_LABELS = {
  ONLINE: 'Trực tuyến',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}

const buildBookingEmail = (booking) => {
  const payment = booking.payment
  const paymentMethod =
    PAYMENT_METHOD_LABELS[payment?.paymentMethod] ||
    payment?.paymentMethod ||
    'Chưa chọn'
  const paymentStatus =
    PAYMENT_STATUS_LABELS[booking.paymentStatus] || booking.paymentStatus
  const seatsText = booking.seats
    .map(
      (seat) =>
        `${seat.seatCode} (${formatCurrency(seat.price)})`,
    )
    .join(', ')
  const instruction = getPaymentInstruction(payment)
  const details = {
    passengerName: booking.passenger.fullName,
    passengerPhone: formatVietnamesePhone(booking.passenger.phone),
    bookingCode: booking.bookingCode,
    routeName: booking.trip.route.routeName,
    departureTime: formatVietnamDateTime(booking.trip.departureTime),
    busName: `${booking.trip.bus.busName} - ${formatLicensePlate(booking.trip.bus.licensePlate)}`,
    seatsText,
    totalAmount: formatCurrency(booking.totalAmount),
    source: SOURCE_LABELS[booking.source] || 'Chưa xác định',
    pickupPoint: booking.pickupPoint || 'Theo điểm đi của tuyến',
    dropoffPoint: booking.dropoffPoint || 'Theo điểm đến của tuyến',
    paymentMethod,
    paymentStatus,
  }

  const text = [
    'NHÀ XE THÀNH NHÂN - VÉ ĐIỆN TỬ',
    `Hành khách: ${details.passengerName}`,
    `Số điện thoại: ${details.passengerPhone}`,
    `Mã đặt vé: ${details.bookingCode}`,
    `Tuyến: ${details.routeName}`,
    `Khởi hành: ${details.departureTime}`,
    `Xe: ${details.busName}`,
    `Ghế/phòng: ${details.seatsText}`,
    `Tổng tiền: ${details.totalAmount}`,
    `Nguồn đặt: ${details.source}`,
    `Điểm đón: ${details.pickupPoint}`,
    `Điểm trả: ${details.dropoffPoint}`,
    `Phương thức: ${details.paymentMethod}`,
    `Trạng thái thanh toán: ${details.paymentStatus}`,
    instruction,
    'Quý khách vui lòng có mặt trước giờ khởi hành ít nhất 30 phút.',
  ].join('\n')

  const rows = [
    ['Hành khách', details.passengerName],
    ['Số điện thoại', details.passengerPhone],
    ['Mã đặt vé', details.bookingCode],
    ['Tuyến đường', details.routeName],
    ['Khởi hành', details.departureTime],
    ['Xe', details.busName],
    ['Ghế/phòng', details.seatsText],
    ['Tổng tiền', details.totalAmount],
    ['Nguồn đặt', details.source],
    ['Điểm đón', details.pickupPoint],
    ['Điểm trả', details.dropoffPoint],
    ['Phương thức', details.paymentMethod],
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
    <main style="max-width:680px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden">
      <header style="background:#8b1025;color:#fff;padding:24px"><h1 style="margin:0">Nhà xe Thành Nhân</h1><p style="margin:8px 0 0">Vé xe điện tử</p></header>
      <section style="padding:24px">
        <p>Kính chào <strong>${escapeHtml(details.passengerName)}</strong>,</p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        <p style="margin-top:20px;padding:14px;background:#fff7ed;border-radius:8px"><strong>${escapeHtml(instruction)}</strong></p>
        <p>Quý khách vui lòng có mặt trước giờ khởi hành ít nhất 30 phút.</p>
      </section>
    </main>
  </body>
</html>`

  return {
    subject: `Vé điện tử ${booking.bookingCode} - Nhà xe Thành Nhân`,
    text,
    html,
  }
}

export { buildBookingEmail, escapeHtml, formatVietnamDateTime }
