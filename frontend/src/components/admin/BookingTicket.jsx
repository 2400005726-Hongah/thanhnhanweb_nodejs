import { getBusTypeLabel } from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate, formatPhoneInput } from '../../utils/normalizers.js'
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

const displayLocation = (location) => {
  if (!location) {
    return 'Chưa cập nhật'
  }

  if (typeof location === 'string') {
    return location
  }

  return [
    location.name,
    location.province,
  ]
    .filter(Boolean)
    .join(', ') || 'Chưa cập nhật'
}

function BookingTicket({ booking }) {
  if (!booking) {
    return null
  }

  const route = booking.trip?.route
  const bus = booking.trip?.bus

  const payments =
    booking.payments ?? []

  const payment =
    payments[0] ??
    booking.payment ??
    null

  const items =
    booking.items ??
    booking.seats ??
    []

  const seatCodes =
    items
      .map((item) => item.seatCode)
      .filter(Boolean)
      .join(', ') || 'Chưa cập nhật'

  /*
   * Ưu tiên điểm đón/trả riêng của vé.
   * Nếu database chưa có thì dùng điểm đầu/cuối của tuyến.
   */
  const pickupPoint =
    booking.pickupPoint ??
    booking.pickupLocation ??
    booking.pickupAddress ??
    route?.departureLocation

  const dropoffPoint =
    booking.dropoffPoint ??
    booking.dropoffLocation ??
    booking.dropoffAddress ??
    route?.arrivalLocation

  const busDescription = [
    bus?.licensePlate ? formatLicensePlate(bus.licensePlate) : null,
    bus?.busName || (bus?.busType ? getBusTypeLabel(bus.busType) : null),
  ]
    .filter(Boolean)
    .join(' - ')

  return (
    <section
      className="ticket-print-sheet"
      aria-label="Vé xe điện tử"
    >
      <div className="ticket-print-card">
        <header className="ticket-print-header">
          <h1>VÉ ĐIỆN TỬ</h1>
          <p>Nhà xe Thành Nhân</p>
        </header>

        <div className="ticket-print-code">
          <span>MÃ VÉ</span>

          <strong>
            {booking.bookingCode ||
              booking.id ||
              'Chưa cập nhật'}
          </strong>
        </div>

        <div className="ticket-print-info">
          <div className="ticket-print-row">
            <span>Khách hàng</span>

            <strong>
              {booking.passengerFullName ||
                booking.customer?.fullName ||
                'Chưa cập nhật'}
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
            <span>Tuyến</span>

            <strong>
              {route?.routeName ||
                'Chưa cập nhật'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Điểm đón</span>

            <strong>
              {displayLocation(pickupPoint)}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Điểm trả</span>

            <strong>
              {displayLocation(dropoffPoint)}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Ngày giờ xuất bến</span>

            <strong>
              {booking.trip?.departureTime
                ? formatDateTime(
                    booking.trip.departureTime,
                  )
                : 'Chưa cập nhật'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Số ghế</span>

            <strong>{seatCodes}</strong>
          </div>

          <div className="ticket-print-row">
            <span>Xe</span>

            <strong>
              {busDescription ||
                'Chưa cập nhật'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Giá vé</span>

            <strong>
              {formatCurrency(
                booking.totalAmount ?? 0,
              )}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Trạng thái vé</span>

            <strong>
              {BOOKING_STATUS_LABELS[
                booking.status
              ] ||
                booking.status ||
                'Chưa xác định'}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Thanh toán</span>

            <strong>
              {getPaymentStatusLabel(
                payment?.status ||
                  booking.paymentStatus,
              )}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Phương thức</span>

            <strong>
              {getPaymentMethodLabel(
                payment?.paymentMethod,
              )}
            </strong>
          </div>

          <div className="ticket-print-row">
            <span>Nguồn đặt</span>

            <strong>
              {SOURCE_LABELS[
                booking.source
              ] ||
                booking.source ||
                'Chưa xác định'}
            </strong>
          </div>
        </div>

        <footer className="ticket-print-footer">
          <p>
            Vui lòng có mặt trước giờ khởi hành
            ít nhất 30 phút.
          </p>

          <small>
            Ngày đặt vé:{' '}
            {booking.createdAt
              ? formatDateTime(
                  booking.createdAt,
                )
              : 'Chưa cập nhật'}
          </small>
        </footer>
      </div>
    </section>
  )
}

export default BookingTicket