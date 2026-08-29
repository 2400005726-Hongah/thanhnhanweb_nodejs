import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { LoadingState } from '../components/common/StatusState.jsx'

import {
  cancelMyBooking,
  getMyBookings,
} from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatBookingCode } from '../utils/normalizers.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import {
  PAYMENT_STATUS_LABELS,
  getPaymentMethodLabel,
} from '../utils/paymentLabels.js'

const bookingStatusLabel = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
  COMPLETED: 'Đã hoàn thành',
}

const initialResult = {
  bookings: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
}

function MyBookingsPage() {
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    sort: 'createdAtDesc',
    page: 1,
  })
  const [result, setResult] = useState(initialResult)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancellingCode, setCancellingCode] = useState('')

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(
        await getMyBookings({
          ...filters,
          status: filters.status || undefined,
          paymentStatus: filters.paymentStatus || undefined,
          limit: 10,
        }),
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  const updateFilter = (event) => {
    setNotice('')
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value,
      page: 1,
    }))
  }

  const cancel = async (booking) => {
    if (cancellingCode) return

    const message = [
      `Bạn có chắc muốn hủy vé ${formatBookingCode(booking.bookingCode)}?`,
      `Chuyến: ${booking.trip.route.routeName}`,
      `Ghế: ${booking.seats.map((seat) => seat.seatCode).join(', ')}`,
      `Tổng tiền: ${formatCurrency(booking.totalAmount)}`,
      booking.paymentStatus === 'SUCCESS'
        ? 'Khoản đã thanh toán sẽ được hoàn tiền mô phỏng.'
        : '',
    ].filter(Boolean).join('\n')

    if (!window.confirm(message)) return
    const reason = window.prompt('Nhập lý do hủy vé (bắt buộc):')
    if (!reason || reason.trim().length < 5) {
      setError('Lý do hủy vé phải có ít nhất 5 ký tự.')
      return
    }

    setCancellingCode(booking.bookingCode)
    setError('')
    setNotice('')
    try {
      const cancellation = await cancelMyBooking(
        booking.bookingCode,
        reason.trim(),
      )
      setResult((current) => ({
        ...current,
        bookings: current.bookings.map((item) =>
          item.bookingCode === cancellation.bookingCode
            ? {
                ...item,
                status: cancellation.status,
                paymentStatus: cancellation.paymentStatus,
                canCancel: false,
                payment: item.payment
                  ? {
                      ...item.payment,
                      status: cancellation.refunded
                        ? 'REFUNDED'
                        : item.payment.status,
                    }
                  : null,
              }
            : item,
        ),
      }))
      setNotice(
        cancellation.refunded
          ? `Hủy vé thành công. Hoàn tiền mô phỏng ${formatCurrency(cancellation.refundAmount)}.`
          : `Hủy vé thành công. Đã giải phóng ${cancellation.releasedSeatCount} ghế.`,
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setCancellingCode('')
    }
  }

  return (
    <div className="page-surface my-bookings-page">
      <section className="page-banner page-banner--compact">
        <div className="container">
          <span className="eyebrow eyebrow--light">TÀI KHOẢN KHÁCH HÀNG</span>
          <h1>Vé của tôi</h1>
          <p>Theo dõi hành trình, thanh toán và thời hạn hủy vé.</p>
        </div>
      </section>

      <div className="container page-content">
        <div className="booking-history-filters">
          <select name="status" value={filters.status} onChange={updateFilter} className="form-select">
            <option value="">Mọi trạng thái booking</option>
            {Object.entries(bookingStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="paymentStatus" value={filters.paymentStatus} onChange={updateFilter} className="form-select">
            <option value="">Mọi trạng thái thanh toán</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="sort" value={filters.sort} onChange={updateFilter} className="form-select">
            <option value="createdAtDesc">Mới đặt gần đây</option>
            <option value="createdAtAsc">Đặt lâu nhất</option>
            <option value="departureTimeAsc">Khởi hành sớm nhất</option>
            <option value="departureTimeDesc">Khởi hành muộn nhất</option>
          </select>
        </div>

        {notice && <div className="alert alert-success mt-3" role="status">{notice}</div>}
        {error && (
          <div className="alert alert-danger mt-3" role="alert">
            {error}
            <button className="btn btn-sm btn-outline-danger ms-3" type="button" onClick={loadBookings}>Thử lại</button>
          </div>
        )}

        {loading ? (
          <LoadingState label="Đang tải lịch sử vé..." />
        ) : !error && result.bookings.length === 0 ? (
          <div className="lookup-placeholder">
            <span className="status-symbol status-symbol--muted">0</span>
            <h2>Chưa có vé phù hợp</h2>
            <p>Bạn có thể tìm chuyến và đặt vé ngay từ trang chủ.</p>
            <Link className="btn btn-primary" to="/tim-chuyen">Tìm chuyến</Link>
          </div>
        ) : (
          <div className="booking-history-list">
            {result.bookings.map((booking) => (
              <article className="booking-history-card" key={booking.id}>
                <div className="booking-history-heading">
                  <div>
                    <span className="eyebrow">MÃ VÉ {formatBookingCode(booking.bookingCode)}</span>
                    <h2>{booking.trip.route.routeName}</h2>
                    <p>Đặt lúc {formatDateTime(booking.createdAt)}</p>
                  </div>
                  <div className="lookup-statuses">
                    <span className={`status-badge status-badge--${booking.status.toLowerCase()}`}>
                      {bookingStatusLabel[booking.status] || booking.status}
                    </span>
                    <span className={`status-badge status-badge--${booking.paymentStatus.toLowerCase()}`}>
                      {PAYMENT_STATUS_LABELS[booking.paymentStatus] || booking.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="booking-history-grid">
                  <div><span>Khởi hành</span><strong>{formatDateTime(booking.trip.departureTime)}</strong></div>
                  <div><span>Xe</span><strong>{booking.trip.bus.busName}</strong></div>
                  <div><span>Ghế</span><strong>{booking.seats.map((seat) => seat.seatCode).join(', ')}</strong></div>
                  <div><span>Tổng tiền</span><strong>{formatCurrency(booking.totalAmount)}</strong></div>
                  <div><span>Phương thức</span><strong>{getPaymentMethodLabel(booking.payment?.paymentMethod)}</strong></div>
                  <div><span>Hạn hủy</span><strong>{booking.canCancel ? formatDateTime(booking.cancelDeadline) : 'Đã hết hiệu lực'}</strong></div>
                </div>

                <div className="booking-history-actions">
                  <Link
                    className="btn btn-outline-primary"
                    state={{ bookingCode: booking.bookingCode }}
                    to="/tra-cuu-ve"
                  >
                    Xem chi tiết
                  </Link>
                  {booking.canCancel && (
                    <button
                      className="btn btn-outline-danger"
                      disabled={Boolean(cancellingCode)}
                      onClick={() => cancel(booking)}
                      type="button"
                    >
                      {cancellingCode === booking.bookingCode
                        ? 'Đang hủy...'
                        : 'Hủy vé'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && result.pagination.totalPages > 1 && (
          <nav className="pagination-wrap" aria-label="Phân trang lịch sử vé">
            <button
              className="btn btn-outline-primary"
              disabled={filters.page <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              type="button"
            >
              Trang trước
            </button>
            <span>Trang {result.pagination.page}/{result.pagination.totalPages}</span>
            <button
              className="btn btn-outline-primary"
              disabled={filters.page >= result.pagination.totalPages}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              type="button"
            >
              Trang sau
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}

export default MyBookingsPage
