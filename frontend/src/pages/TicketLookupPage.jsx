import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  cancelGuestBooking,
  lookupBooking,
} from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import {
  formatPhoneInput,
  isVietnamesePhone,
  normalizeBookingCode,
  normalizePhone,
} from '../utils/normalizers.js'
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../utils/paymentLabels.js'

const bookingStatusLabel = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã đặt',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  COMPLETED: 'Đã hoàn thành',
  NO_SHOW: 'Không đi',
  DELETED: 'Đã xóa',
}

const sourceLabel = {
  ONLINE: 'Trực tuyến',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}

function TicketLookupPage() {
  const location = useLocation()
  const [form, setForm] = useState({
    bookingCode: location.state?.bookingCode || '',
    phone: '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelNotice, setCancelNotice] = useState('')

  const update = (event) => {
    const { name, value } = event.target
    setError('')
    setCancelNotice('')
    setForm((current) => ({
      ...current,
      [name]:
        name === 'bookingCode'
          ? normalizeBookingCode(value)
          : name === 'phone'
            ? formatPhoneInput(value)
            : value,
    }))
  }

  const cancel = async () => {
    if (!result?.booking.canCancel || cancelling) return

    const booking = result.booking
    const message = [
      `Bạn có chắc muốn hủy vé ${booking.bookingCode}?`,
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

    setCancelling(true)
    setError('')
    setCancelNotice('')
    try {
      const cancellation = await cancelGuestBooking(
        booking.bookingCode,
        normalizePhone(form.phone),
        reason.trim(),
      )
      setResult((current) => ({
        ...current,
        booking: {
          ...current.booking,
          status: cancellation.status,
          paymentStatus: cancellation.paymentStatus,
          canCancel: false,
        },
        payment: current.payment
          ? {
              ...current.payment,
              status: cancellation.refunded
                ? 'REFUNDED'
                : current.payment.status,
            }
          : null,
      }))
      setCancelNotice(
        cancellation.refunded
          ? `Hủy vé thành công. Hoàn tiền mô phỏng ${formatCurrency(cancellation.refundAmount)}.`
          : `Hủy vé thành công. Đã giải phóng ${cancellation.releasedSeatCount} ghế.`,
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setCancelling(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return

    const bookingCode = normalizeBookingCode(form.bookingCode)
    const phone = normalizePhone(form.phone)
    if (!/^TN[A-F0-9]{16}$/.test(bookingCode)) {
      setError('Mã đặt vé không đúng định dạng.')
      return
    }
    if (!isVietnamesePhone(phone)) {
      setError('Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setHasSearched(true)
    try {
      setResult(await lookupBooking(bookingCode, phone))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-surface lookup-page">
      <section className="page-banner">
        <div className="container">
          <span className="eyebrow eyebrow--light">THÔNG TIN CHUYẾN ĐI</span>
          <h1>Tra cứu vé</h1>
          <p>Kiểm tra hành trình và trạng thái thanh toán bằng mã vé và số điện thoại.</p>
        </div>
      </section>

      <div className="container lookup-content">
        <form className="lookup-form-card" onSubmit={submit}>
          <div>
            <label className="form-label" htmlFor="lookupBookingCode">Mã đặt vé</label>
            <input
              className="form-control"
              id="lookupBookingCode"
              name="bookingCode"
              value={form.bookingCode}
              onChange={update}
              placeholder="Ví dụ: TNCCFD3AF347848E4A"
              maxLength="18"
              autoComplete="off"
              required
            />
          </div>
          <div>
            <label className="form-label" htmlFor="lookupPhone">Số điện thoại</label>
            <input
              className="form-control"
              id="lookupPhone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={update}
              placeholder="0912 345 678"
              maxLength="12"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </div>
          <button className="btn btn-warning" type="submit" disabled={loading}>
            {loading ? 'Đang tra cứu...' : 'Tra cứu vé'}
          </button>
        </form>

        {error && <div className="alert alert-danger lookup-alert" role="alert">{error}</div>}
        {cancelNotice && <div className="alert alert-success lookup-alert" role="status">{cancelNotice}</div>}

        {!hasSearched && !result && (
          <div className="lookup-placeholder">
            <span className="status-symbol status-symbol--muted">TN</span>
            <h2>Sẵn sàng tra cứu</h2>
            <p>Mã đặt vé và số điện thoại không được đưa lên địa chỉ trang.</p>
          </div>
        )}

        {loading && (
          <div className="lookup-placeholder" role="status">
            <span className="spinner-border text-primary" aria-hidden="true" />
            <p>Đang tải trạng thái vé mới nhất...</p>
          </div>
        )}

        {result && !loading && (
          <section className="lookup-result-card">
            <div className="lookup-result-heading">
              <div>
                <span className="eyebrow">KẾT QUẢ TRA CỨU</span>
                <h2>{result.booking.trip.route.routeName}</h2>
                <p>Mã đặt vé: <strong>{result.booking.bookingCode}</strong></p>
              </div>
              <div className="lookup-statuses">
                <span className={`status-badge status-badge--${result.booking.status.toLowerCase()}`}>
                  {bookingStatusLabel[result.booking.status] || result.booking.status}
                </span>
                <span className={`status-badge status-badge--${result.booking.paymentStatus.toLowerCase()}`}>
                  {getPaymentStatusLabel(result.booking.paymentStatus)}
                </span>
              </div>
            </div>

            <div className="lookup-grid">
              <div><span>Khởi hành</span><strong>{formatDateTime(result.booking.trip.departureTime)}</strong></div>
              <div><span>Đến dự kiến</span><strong>{formatDateTime(result.booking.trip.expectedArrivalTime)}</strong></div>
              <div><span>Hành khách</span><strong>{result.booking.passenger.fullName}</strong></div>
              <div><span>Xe</span><strong>{result.booking.trip.bus.busName}</strong></div>
              <div><span>Ghế</span><strong>{result.booking.seats.map((seat) => seat.seatCode).join(', ')}</strong></div>
              <div><span>Tổng tiền</span><strong className="price-text">{formatCurrency(result.booking.totalAmount)}</strong></div>
              <div><span>Nguồn đặt</span><strong>{sourceLabel[result.booking.source] || 'Chưa xác định'}</strong></div>
              <div><span>Điểm đón</span><strong>{result.booking.pickupPoint || 'Theo điểm đi của tuyến'}</strong></div>
              <div><span>Điểm trả</span><strong>{result.booking.dropoffPoint || 'Theo điểm đến của tuyến'}</strong></div>
            </div>

            {result.payment ? (
              <div className="lookup-payment-block">
                <div><span>Phương thức</span><strong>{getPaymentMethodLabel(result.payment.paymentMethod)}</strong></div>
                <div><span>Trạng thái</span><strong>{getPaymentStatusLabel(result.payment.status)}</strong></div>
                <div><span>Số tiền</span><strong>{formatCurrency(result.payment.amount)}</strong></div>
                {result.payment.transactionCode && <div><span>Mã giao dịch</span><strong>{result.payment.transactionCode}</strong></div>}
                {result.payment.paidAt && <div><span>Thời gian</span><strong>{formatDateTime(result.payment.paidAt)}</strong></div>}
              </div>
            ) : (
              <div className="pending-payment-note mt-4">
                <strong>Chưa có thông tin thanh toán</strong>
              </div>
            )}

            {result.booking.canCancel && (
              <div className="lookup-cancel-block">
                <div>
                  <strong>Vé còn trong thời hạn hủy</strong>
                  <span>Hạn hủy: {formatDateTime(result.booking.cancelDeadline)}</span>
                </div>
                <button
                  className="btn btn-outline-danger"
                  disabled={cancelling}
                  onClick={cancel}
                  type="button"
                >
                  {cancelling ? 'Đang hủy vé...' : 'Hủy vé'}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default TicketLookupPage
