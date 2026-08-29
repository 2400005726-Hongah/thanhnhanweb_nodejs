import { getBusTypeLabel } from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatBookingCode, formatLicensePlate, formatPhoneInput } from '../../utils/normalizers.js'
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../../utils/paymentLabels.js'

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã đặt',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  COMPLETED: 'Đã hoàn thành',
  NO_SHOW: 'Không đi',
  DELETED: 'Đã xóa',
}

const SOURCE_LABELS = {
  ONLINE: 'Trực tuyến',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}

const SERVICE_MODE_LABELS = {
  TaiVanPhong: 'Tại văn phòng nhà xe',
  DonTaiBenXe: 'Đón trực tiếp tại bến xe trung tâm',
  DonTaiDiemHen: 'Đón tại điểm hẹn',
  TrungChuyenDonKhach: 'Xe trung chuyển đón khách',
  TraTaiBenXe: 'Trả khách tại bến xe trung tâm đích đến',
  TraTaiVanPhong: 'Trả khách tại văn phòng nhà xe',
  TraTaiDiemDung: 'Trả khách tại điểm dừng',
  TrungChuyenTraKhach: 'Xe trung chuyển trả tận nơi khu vực nội thành',
}

const displayLocation = (location) => {
  if (!location) return 'Chưa cập nhật'
  if (typeof location === 'string') return location

  return [location.name, location.address, location.province]
    .filter(Boolean)
    .join(', ') || 'Chưa cập nhật'
}

const getTripEndpoints = (trip = {}) => {
  const departure =
    trip.departureLocation ||
    trip.route?.departureLocation ||
    null
  const arrival =
    trip.arrivalLocation ||
    trip.route?.arrivalLocation ||
    null

  return { departure, arrival }
}

function BookingTicket({ booking }) {
  if (!booking) return null

  const trip = booking.trip || {}
  const bus = trip.bus || {}
  const payment = booking.payments?.[0] ?? booking.payment ?? null
  const items = booking.items ?? booking.seats ?? []
  const { departure, arrival } = getTripEndpoints(trip)

  const seatCodes =
    items
      .map((item) => item.seatCode)
      .filter(Boolean)
      .join(', ') || 'Chưa cập nhật'

  const pickupPoint =
    booking.pickupPoint ??
    booking.pickupLocation ??
    booking.pickupAddress ??
    departure

  const dropoffPoint =
    booking.dropoffPoint ??
    booking.dropoffLocation ??
    booking.dropoffAddress ??
    arrival

  const routeName =
    trip.route?.routeName ||
    `${displayLocation(departure)} → ${displayLocation(arrival)}`

  const busDescription = [
    bus.busType ? getBusTypeLabel(bus.busType) : null,
    bus.licensePlate ? formatLicensePlate(bus.licensePlate) : null,
  ]
    .filter(Boolean)
    .join(' - ')

  const pickupMode =
    SERVICE_MODE_LABELS[booking.pickupServiceMode] ||
    'Điểm đón chính của chuyến'
  const dropoffMode =
    SERVICE_MODE_LABELS[booking.dropoffServiceMode] ||
    'Điểm trả chính của chuyến'

  return (
    <section className="ticket-print-sheet" aria-label="Vé xe điện tử">
      <div className="ticket-print-card">
        <header className="ticket-print-header">
          <h1>VÉ ĐIỆN TỬ</h1>
          <p>Nhà xe Thành Nhân</p>
        </header>

        <div className="ticket-print-code">
          <span>MÃ VÉ</span>
          <strong>{booking.bookingCode ? formatBookingCode(booking.bookingCode) : booking.id || 'Chưa cập nhật'}</strong>
        </div>

        <div className="ticket-print-info">
          <div className="ticket-print-row">
            <span>Mã giao dịch</span>
            <strong>{payment?.transactionCode || booking.transactionCode || '—'}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Khách hàng</span>
            <strong>
              {booking.passengerFullName || booking.customer?.fullName || 'Chưa cập nhật'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Số điện thoại</span>
            <strong>
              {booking.passengerPhone || booking.customer?.phone
                ? formatPhoneInput(booking.passengerPhone || booking.customer?.phone)
                : 'Chưa cập nhật'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Hành trình</span>
            <strong>{routeName}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Điểm đón</span>
            <strong>{displayLocation(pickupPoint)}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Hình thức đón</span>
            <strong>{pickupMode}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Điểm trả</span>
            <strong>{displayLocation(dropoffPoint)}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Hình thức trả</span>
            <strong>{dropoffMode}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Ngày giờ xuất bến</span>
            <strong>
              {trip.departureTime ? formatDateTime(trip.departureTime) : 'Chưa cập nhật'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Ghế/Phòng</span>
            <strong>{seatCodes}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Xe</span>
            <strong>{busDescription || 'Chưa cập nhật'}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Tổng tiền</span>
            <strong>{formatCurrency(booking.totalAmount ?? 0)}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Trạng thái vé</span>
            <strong>
              {BOOKING_STATUS_LABELS[booking.status] || booking.status || 'Chưa xác định'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Thanh toán</span>
            <strong>{getPaymentStatusLabel(payment?.status || booking.paymentStatus)}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Phương thức</span>
            <strong>{getPaymentMethodLabel(payment?.paymentMethod)}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Nguồn đặt</span>
            <strong>{SOURCE_LABELS[booking.source] || booking.source || 'Chưa xác định'}</strong>
          </div>
        </div>

        <footer className="ticket-print-footer">
          <p>Vui lòng có mặt theo hướng dẫn tại điểm đón đã chọn.</p>
          <small>
            Ngày đặt vé: {booking.createdAt ? formatDateTime(booking.createdAt) : 'Chưa cập nhật'}
          </small>
        </footer>
      </div>
    </section>
  )
}

export default BookingTicket
