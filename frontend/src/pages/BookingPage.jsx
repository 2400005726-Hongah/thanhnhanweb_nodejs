import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import { createBooking, releaseSeatHold } from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripDetail } from '../services/publicTrip.service.js'
import {
  clearSeatHold,
  getSeatHold,
  saveBookingResult,
} from '../utils/bookingSession.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'

const emptyPassenger = { fullName: '', phone: '', email: '' }

const getRemainingSeconds = (expiresAt) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))

const formatCountdown = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function BookingPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [hold] = useState(() => getSeatHold(tripId))
  const [detail, setDetail] = useState(null)
  const [passenger, setPassenger] = useState(emptyPassenger)
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    hold ? getRemainingSeconds(hold.holdExpiresAt) : 0,
  )
  const [loading, setLoading] = useState(Boolean(hold))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const releaseOnExit = useRef(true)

  const loadTrip = useCallback(() => {
    if (!hold) return
    setLoading(true)
    setError('')
    getTripDetail(tripId)
      .then(setDetail)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false))
  }, [hold, tripId])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  useEffect(() => {
    if (!hold) return undefined
    const update = () => setRemainingSeconds(getRemainingSeconds(hold.holdExpiresAt))
    update()
    const intervalId = window.setInterval(update, 1000)
    return () => window.clearInterval(intervalId)
  }, [hold])

  useEffect(() => {
    if (!hold) return undefined

    let canRelease = false
    const activationTimer = window.setTimeout(() => {
      canRelease = true
    }, 0)

    return () => {
      window.clearTimeout(activationTimer)
      if (canRelease && releaseOnExit.current) {
        void releaseSeatHold(tripId, hold.holdToken).catch(() => {})
      }
    }
  }, [hold, tripId])

  useEffect(() => {
    if (!hold || remainingSeconds > 0 || !releaseOnExit.current) return
    releaseOnExit.current = false
    clearSeatHold(tripId)
    void releaseSeatHold(tripId, hold.holdToken).catch(() => {})
  }, [hold, remainingSeconds, tripId])

  const updatePassenger = (event) => {
    setValidation('')
    setPassenger((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const validatePassenger = () => {
    const fullName = passenger.fullName.trim()
    const phone = passenger.phone.replace(/[\s().-]/g, '')
    if (fullName.length < 2) return 'Vui lòng nhập đầy đủ họ tên hành khách.'
    if (!/^(?:\+84|84|0)(?:3|5|7|8|9)[0-9]{8}$/.test(phone)) {
      return 'Số điện thoại Việt Nam không hợp lệ.'
    }
    if (passenger.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email)) {
      return 'Email không hợp lệ.'
    }
    return ''
  }

  const submitBooking = async (event) => {
    event.preventDefault()
    if (!hold || remainingSeconds <= 0 || submitting) return

    const validationMessage = validatePassenger()
    if (validationMessage) {
      setValidation(validationMessage)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const data = await createBooking({
        tripId,
        holdToken: hold.holdToken,
        passenger: {
          fullName: passenger.fullName.trim(),
          phone: passenger.phone.trim(),
          email: passenger.email.trim() || undefined,
        },
      })
      releaseOnExit.current = false
      clearSeatHold(tripId)
      saveBookingResult(data.booking)
      navigate(`/dat-ve-thanh-cong/${data.booking.bookingCode}`, {
        replace: true,
        state: { booking: data.booking },
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
      if (requestError.response?.status === 409) {
        releaseOnExit.current = false
        clearSeatHold(tripId)
        setRemainingSeconds(0)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const cancelHold = async () => {
    if (!hold) return
    setSubmitting(true)
    try {
      await releaseSeatHold(tripId, hold.holdToken)
    } catch {
      // The seat endpoint also releases expired holds on the next refresh.
    } finally {
      releaseOnExit.current = false
      clearSeatHold(tripId)
      navigate(`/chuyen-xe/${tripId}`)
    }
  }

  const heldSeatCodes = useMemo(
    () => hold?.seats.map((seat) => seat.seatCode).join(', ') || '',
    [hold],
  )

  if (!hold) {
    return (
      <div className="simple-page">
        <div className="status-symbol">!</div>
        <span className="eyebrow">CHƯA CÓ GHẾ ĐƯỢC GIỮ</span>
        <h1>Vui lòng chọn ghế trước</h1>
        <p>Phiên giữ ghế không tồn tại hoặc đã được hoàn tất.</p>
        <Link className="btn btn-primary" to="/tim-chuyen">
          Tìm chuyến xe
        </Link>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="container page-content">
        <LoadingState label="Đang chuẩn bị thông tin đặt vé..." />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="container page-content">
        <ErrorState message={error} onRetry={loadTrip} />
      </div>
    )
  }

  const expired = remainingSeconds <= 0
  const trip = detail.trip

  return (
    <div className="page-surface booking-flow-page">
      <section className="page-banner page-banner--compact">
        <div className="container">
          <span className="eyebrow eyebrow--light">HOÀN TẤT ĐẶT VÉ</span>
          <h1>Thông tin hành khách</h1>
          <p>Ghế đang được giữ tạm thời trong khi bạn hoàn tất thông tin.</p>
        </div>
      </section>
      <div className="container page-content">
        <div className="hold-timer-card">
          <div>
            <span>Thời gian giữ ghế còn lại</span>
            <strong className={remainingSeconds <= 120 ? 'is-urgent' : ''}>
              {formatCountdown(remainingSeconds)}
            </strong>
          </div>
          <p>
            {expired
              ? 'Thời gian giữ ghế đã hết. Vui lòng quay lại chọn ghế.'
              : 'Vui lòng hoàn tất trước khi đồng hồ về 00:00.'}
          </p>
        </div>

        <div className="row g-4 align-items-start">
          <div className="col-lg-7">
            <form className="booking-form-card" onSubmit={submitBooking}>
              <span className="eyebrow">THÔNG TIN LIÊN HỆ</span>
              <h2>Người đi xe</h2>
              <p>Nhà xe sử dụng thông tin này để xác nhận vé và hỗ trợ chuyến đi.</p>

              {error && <div className="alert alert-danger">{error}</div>}
              {validation && <div className="alert alert-warning">{validation}</div>}

              <label className="form-label" htmlFor="fullName">
                Họ và tên
              </label>
              <input
                className="form-control mb-3"
                id="fullName"
                name="fullName"
                value={passenger.fullName}
                onChange={updatePassenger}
                maxLength="100"
                autoComplete="name"
                required
              />

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="phone">
                    Số điện thoại
                  </label>
                  <input
                    className="form-control"
                    id="phone"
                    name="phone"
                    type="tel"
                    value={passenger.phone}
                    onChange={updatePassenger}
                    maxLength="20"
                    autoComplete="tel"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="email">
                    Email <span className="text-muted">(không bắt buộc)</span>
                  </label>
                  <input
                    className="form-control"
                    id="email"
                    name="email"
                    type="email"
                    value={passenger.email}
                    onChange={updatePassenger}
                    maxLength="255"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="booking-form-actions">
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={cancelHold}
                  disabled={submitting}
                >
                  Hủy và chọn lại ghế
                </button>
                <button
                  className="btn btn-warning btn-lg"
                  type="submit"
                  disabled={expired || submitting}
                >
                  {submitting ? 'Đang tạo booking...' : 'Xác nhận đặt vé'}
                </button>
              </div>
            </form>
          </div>

          <div className="col-lg-5">
            <aside className="booking-review-card">
              <span className="eyebrow">CHUYẾN ĐI CỦA BẠN</span>
              <h2>{trip.route.routeName}</h2>
              <p>{formatDateTime(trip.departureTime)}</p>
              <div className="summary-row">
                <span>Xe</span>
                <strong>{trip.bus.busName}</strong>
              </div>
              <div className="summary-row">
                <span>Ghế đang giữ</span>
                <strong>{heldSeatCodes}</strong>
              </div>
              <div className="summary-row">
                <span>Số lượng</span>
                <strong>{hold.seats.length} ghế</strong>
              </div>
              <div className="summary-total">
                <span>Tổng tiền máy chủ</span>
                <strong>{formatCurrency(hold.totalAmount)}</strong>
              </div>
              <p className="summary-note">
                Booking sẽ ở trạng thái chờ thanh toán. Task này chưa thu tiền.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingPage
