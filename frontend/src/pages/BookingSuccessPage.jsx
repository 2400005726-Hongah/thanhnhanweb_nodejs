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

  return (
    <div className="booking-success-page">
      <div className="booking-success-card">
        <div className="success-mark" aria-hidden="true">✓</div>
        <span className="eyebrow">
          {isPaid ? 'THANH TOÁN THÀNH CÔNG' : 'ĐẶT VÉ THÀNH CÔNG'}
        </span>
        <h1>
          {isPaid ? 'Booking đã được xác nhận' : 'Đã ghi nhận booking của bạn'}
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
            Booking: {booking.status}
          </span>
          <span className={`status-badge status-badge--${booking.paymentStatus.toLowerCase()}`}>
            Thanh toán: {booking.paymentStatus}
          </span>
        </div>

        <div className="success-details">
          <div><span>Hành trình</span><strong>{booking.trip.route.routeName}</strong></div>
          <div><span>Khởi hành</span><strong>{formatDateTime(booking.trip.departureTime)}</strong></div>
          <div><span>Hành khách</span><strong>{booking.passenger.fullName}</strong></div>
          <div><span>Số điện thoại</span><strong>{booking.passenger.phone}</strong></div>
          <div><span>Ghế</span><strong>{booking.seats.map((seat) => seat.seatCode).join(', ')}</strong></div>
          <div><span>Tổng tiền</span><strong>{formatCurrency(booking.totalAmount)}</strong></div>
        </div>

        {payment && (
          <div className="payment-receipt">
            <div><span>Mã giao dịch</span><strong>{payment.transactionCode}</strong></div>
            <div><span>Phương thức</span><strong>{payment.paymentMethod}</strong></div>
            <div><span>Thời gian</span><strong>{formatDateTime(payment.paidAt)}</strong></div>
          </div>
        )}

        {!isPaid && (
          <div className="pending-payment-note">
            <strong>Trạng thái: Chờ thanh toán</strong>
          </div>
        )}

        {paymentError && <div className="alert alert-danger mt-3" role="alert">{paymentError}</div>}

        {!isPaid && (
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
