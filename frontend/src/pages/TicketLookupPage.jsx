import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  cancelGuestBooking,
  lookupBooking,
} from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'

const bookingStatusLabel = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
  COMPLETED: 'Đã hoàn thành',
}

const paymentStatusLabel = {
  PENDING: 'Chờ thanh toán',
  SUCCESS: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
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
    setError('')
    setCancelNotice('')
    setForm((current) => ({
      ...current,
      [event.target.name]:
        event.target.name === 'bookingCode'
          ? event.target.value.toUpperCase()
          : event.target.value,
    }))
  }

  const cancel = async () => {
    if (!result?.booking.canCancel || cancelling) return

    const booking = result.booking
    const message = [
      `Bạn có chắc muốn hủy booking ${booking.bookingCode}?`,
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
        form.phone.trim(),
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

    const bookingCode = form.bookingCode.trim().toUpperCase()
    const phone = form.phone.trim()
    if (!/^TN[A-F0-9]{16}$/.test(bookingCode)) {
      setError('Mã đặt vé không đúng định dạng.')
      return
    }
    if (!/^(?:\+84|84|0)(?:3|5|7|8|9)[0-9]{8}$/.test(phone.replace(/[\s().-]/g, ''))) {
      setError('Số điện thoại Việt Nam không hợp lệ.')
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
          <p>Kiểm tra hành trình và trạng thái thanh toán bằng thông tin booking.</p>
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
              placeholder="Số điện thoại đã đặt vé"
              maxLength="20"
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
            <p>Đang tải trạng thái booking mới nhất...</p>
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
                  {paymentStatusLabel[result.booking.paymentStatus] || result.booking.paymentStatus}
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
            </div>

            {result.payment ? (
              <div className="lookup-payment-block">
                <div><span>Mã giao dịch</span><strong>{result.payment.transactionCode}</strong></div>
                <div><span>Phương thức</span><strong>{result.payment.paymentMethod}</strong></div>
                <div><span>Đã thanh toán</span><strong>{formatCurrency(result.payment.amount)}</strong></div>
                <div><span>Thời gian</span><strong>{formatDateTime(result.payment.paidAt)}</strong></div>
              </div>
            ) : (
              <div className="pending-payment-note mt-4">
                <strong>Booking chưa thanh toán</strong>
                <span>Bạn có thể thanh toán tại trang xác nhận booking.</span>
              </div>
            )}

            {result.booking.canCancel && (
              <div className="lookup-cancel-block">
                <div>
                  <strong>Booking còn trong thời hạn hủy</strong>
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
