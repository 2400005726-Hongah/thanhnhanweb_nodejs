import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { lookupBooking, simulatePayment } from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import {
  getBookingResult,
  saveBookingResult,
} from '../utils/bookingSession.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../utils/paymentLabels.js'

function BookingSuccessPage() {
  const { bookingCode } = useParams()
  const location = useLocation()
  const [booking, setBooking] = useState(
    () => location.state?.booking || getBookingResult(bookingCode),
  )
  const [payment, setPayment] = useState(() => booking?.payment || null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const updatePaidResult = (data) => {
    const storedBooking = { ...data.booking, payment: data.payment }
    setBooking(storedBooking)
    setPayment(data.payment)
    saveBookingResult(storedBooking)
  }

  const payBooking = async () => {
    if (
      !booking ||
      paymentLoading ||
      booking.status !== 'PENDING' ||
      booking.paymentStatus !== 'PENDING'
    ) {
      return
    }

    setPaymentLoading(true)
    setPaymentError('')
    try {
      updatePaidResult(
        await simulatePayment(booking.bookingCode, booking.passenger.phone),
      )
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        try {
          const latest = await lookupBooking(
            booking.bookingCode,
            booking.passenger.phone,
          )
          if (latest.booking.paymentStatus === 'SUCCESS') {
            updatePaidResult(latest)
            return
          }
        } catch {
          // Preserve the original payment error when synchronization fails.
        }
      }
      setPaymentError(getApiErrorMessage(requestError))
    } finally {
      setPaymentLoading(false)
    }
  }

  if (!booking) {
    return (
      <div className="simple-page">
        <div className="status-symbol">?</div>
        <span className="eyebrow">KHÔNG CÓ THÔNG TIN BOOKING</span>
        <h1>Tra cứu lại booking của bạn</h1>
        <p>Nhập mã đặt vé và số điện thoại để xem trạng thái mới nhất.</p>
        <Link
          className="btn btn-primary"
          to="/tra-cuu-ve"
          state={{ bookingCode }}
        >
          Tra cứu vé
        </Link>
      </div>
    )
  }

  const isPaid =
    booking.status === 'CONFIRMED' && booking.paymentStatus === 'SUCCESS'
  const isPayAtBus = payment?.paymentMethod === 'PAY_AT_BUS'
  const canUseLegacyPayment =
    !payment &&
    booking.status === 'PENDING' &&
    booking.paymentStatus === 'PENDING'

  return (
    <div className="booking-success-page">
      <div className="booking-success-card">
        <div className="success-mark" aria-hidden="true">✓</div>
        <span className="eyebrow">
          {isPaid ? 'THANH TOÁN THÀNH CÔNG' : 'ĐẶT VÉ THÀNH CÔNG'}
        </span>
        <h1>
          {isPayAtBus
            ? 'Vé đã được đặt thành công'
            : isPaid
              ? 'Booking đã được xác nhận'
              : 'Đã ghi nhận booking của bạn'}
        </h1>
        <p className="success-copy">
          Vui lòng lưu mã đặt vé để tra cứu trạng thái chuyến đi bất cứ lúc nào.
        </p>

        <div className="booking-code-block">
          <span>Mã đặt vé</span>
          <strong>{booking.bookingCode}</strong>
        </div>

        <div className="success-status-row">
          <span className={`status-badge status-badge--${booking.status.toLowerCase()}`}>
            Trạng thái vé: {booking.status === 'CONFIRMED' ? 'Đã đặt' : booking.status}
          </span>
          <span className={`status-badge status-badge--${booking.paymentStatus.toLowerCase()}`}>
            Thanh toán: {getPaymentStatusLabel(booking.paymentStatus)}
          </span>
        </div>

        <div className="success-details">
          <div><span>Hành trình</span><strong>{booking.trip.route.routeName}</strong></div>
          <div><span>Khởi hành</span><strong>{formatDateTime(booking.trip.departureTime)}</strong></div>
          <div><span>Hành khách</span><strong>{booking.passenger.fullName}</strong></div>
          <div><span>Số điện thoại</span><strong>{booking.passenger.phone}</strong></div>
          <div><span>Ghế</span><strong>{booking.seats.map((seat) => seat.seatCode).join(', ')}</strong></div>
          <div><span>Tổng tiền</span><strong>{formatCurrency(booking.totalAmount)}</strong></div>
          <div><span>Nguồn đặt</span><strong>{booking.source}</strong></div>
          <div><span>Email vé</span><strong>{booking.emailSent ? 'Đã gửi' : booking.emailStatus === 'SKIPPED' ? 'Không có email' : 'Chưa gửi'}</strong></div>
        </div>

        {payment && (
          <div className="payment-receipt">
            {payment.transactionCode && <div><span>Mã giao dịch</span><strong>{payment.transactionCode}</strong></div>}
            <div><span>Hình thức</span><strong>{getPaymentMethodLabel(payment.paymentMethod)}</strong></div>
            <div><span>Trạng thái</span><strong>{getPaymentStatusLabel(payment.status)}</strong></div>
            {payment.paidAt && <div><span>Thời gian</span><strong>{formatDateTime(payment.paidAt)}</strong></div>}
          </div>
        )}

        {isPayAtBus && (
          <div className="pending-payment-note">
            <strong>Thanh toán: Chưa thanh toán</strong>
            <span>Vé đã được đặt thành công. Quý khách vui lòng thanh toán khi lên xe.</span>
          </div>
        )}

        {!isPaid && !isPayAtBus && (
          <div className="pending-payment-note">
            <strong>Trạng thái: {getPaymentStatusLabel(booking.paymentStatus)}</strong>
          </div>
        )}

        {booking.emailWarning && <div className="alert alert-warning mt-3" role="status">{booking.emailWarning}</div>}

        {paymentError && <div className="alert alert-danger mt-3" role="alert">{paymentError}</div>}

        {canUseLegacyPayment && (
          <button
            className="btn btn-warning btn-lg w-100 mt-3"
            type="button"
            disabled={paymentLoading}
            onClick={payBooking}
          >
            {paymentLoading ? 'Đang xử lý thanh toán...' : 'Thanh toán'}
          </button>
        )}

        <div className="success-actions">
          <Link className="btn btn-primary" to="/">Về trang chủ</Link>
          <Link
            className="btn btn-outline-primary"
            to="/tra-cuu-ve"
            state={{ bookingCode: booking.bookingCode }}
          >
            Tra cứu vé
          </Link>
        </div>
      </div>
    </div>
  )
}

export default BookingSuccessPage
