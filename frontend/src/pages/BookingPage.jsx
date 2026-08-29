import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import BookingFlowSteps from '../components/booking/BookingFlowSteps.jsx'
import { validateServiceSelection } from '../components/booking/BookingServicePointFields.jsx'
import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripDetail, getTripServicePoints } from '../services/publicTrip.service.js'
import {
  getBookingPassengerDraft,
  getBookingSeatDraft,
  saveBookingPassengerDraft,
} from '../utils/bookingFlowDraft.js'
import {
  getBookingServiceSelection,
  getSelectedServiceSummary,
  saveBookingServiceSelection,
} from '../utils/bookingServiceSelection.js'
import { getBusTypeLabel, getSeatTypeLabel } from '../utils/busTypes.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import {
  formatLicensePlate,
  formatPhoneInput,
  isValidFullName,
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizeMultilineText,
  normalizePhone,
} from '../utils/normalizers.js'

import './BookingPageStep3.css'

const emptyPassenger = { fullName: '', phone: '', email: '' }

function BookingPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [seatDraft] = useState(() => getBookingSeatDraft(tripId))
  const [serviceSelection] = useState(
    () =>
      getBookingServiceSelection(tripId) ||
      location.state?.bookingServiceSelection ||
      null,
  )
  const savedPassengerDraft = useMemo(() => getBookingPassengerDraft(tripId), [tripId])
  const [detail, setDetail] = useState(null)
  const [servicePoints, setServicePoints] = useState(null)
  const [passenger, setPassenger] = useState(savedPassengerDraft?.passenger || emptyPassenger)
  const [customerNote, setCustomerNote] = useState(savedPassengerDraft?.customerNote || '')
  const [loading, setLoading] = useState(Boolean(seatDraft && serviceSelection))
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const [leaving, setLeaving] = useState(false)

  const loadTrip = useCallback(() => {
    if (!seatDraft || !serviceSelection) return
    setLoading(true)
    setError('')
    Promise.all([getTripDetail(tripId), getTripServicePoints(tripId)])
      .then(([tripDetail, servicePointData]) => {
        setDetail(tripDetail)
        setServicePoints(servicePointData)
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false))
  }, [seatDraft, serviceSelection, tripId])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  useEffect(() => {
    if (!serviceSelection) return
    try {
      saveBookingServiceSelection(tripId, serviceSelection)
    } catch {
      // Router state vẫn đủ để Bước 3 tiếp tục trong phiên hiện tại.
    }
  }, [serviceSelection, tripId])

  const serviceData = useMemo(() => {
    if (!servicePoints) return null
    return {
      ...servicePoints,
      trip: {
        ...(servicePoints.trip || {}),
        departureTime: detail?.trip?.departureTime,
        expectedArrivalTime: detail?.trip?.expectedArrivalTime,
      },
    }
  }, [detail, servicePoints])

  const serviceSummary = useMemo(
    () => getSelectedServiceSummary(serviceData, serviceSelection),
    [serviceData, serviceSelection],
  )

  const updatePassenger = (event) => {
    const { name, value } = event.target
    setValidation('')
    setPassenger((current) => ({
      ...current,
      [name]: name === 'phone' ? formatPhoneInput(value) : value,
    }))
  }

  const validatePassenger = () => {
    if (!passenger.email.trim()) return 'Email là bắt buộc khi đặt vé trực tuyến.'

    const fullName = normalizeFullName(passenger.fullName)
    const phone = normalizePhone(passenger.phone)
    const email = normalizeEmail(passenger.email)

    if (!isValidFullName(fullName)) return 'Vui lòng nhập họ tên hợp lệ, không dùng số hoặc ký tự đặc biệt.'
    if (!isVietnamesePhone(phone)) return 'Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ.'
    return ''
  }

  const continueToPayment = (event) => {
    event.preventDefault()
    if (leaving) return

    const passengerMessage = validatePassenger()
    if (passengerMessage) {
      setValidation(passengerMessage)
      return
    }

    const serviceMessage = validateServiceSelection(serviceData, serviceSelection)
    if (serviceMessage) {
      setValidation(`${serviceMessage} Vui lòng quay lại Bước 2 để chọn lại điểm đón/trả.`)
      return
    }

    saveBookingPassengerDraft(
      tripId,
      {
        fullName: normalizeFullName(passenger.fullName),
        phone: normalizePhone(passenger.phone),
        email: normalizeEmail(passenger.email),
      },
      normalizeMultilineText(customerNote),
    )
    setLeaving(true)
    navigate(`/dat-ve/${tripId}/thanh-toan`)
  }

  const seatDescriptions = useMemo(
    () => seatDraft?.seats?.map((seat) => `${seat.seatCode} · ${getSeatTypeLabel(seat.seatType)}`).join(', ') || '',
    [seatDraft],
  )

  if (!seatDraft) {
    return (
      <div className="simple-page">
        <div className="status-symbol">1</div>
        <span className="eyebrow">CHƯA CHỌN CHỖ</span>
        <h1>Vui lòng hoàn tất Bước 1</h1>
        <Link className="btn btn-primary" to={`/chuyen-xe/${tripId}`}>Quay lại chọn chỗ</Link>
      </div>
    )
  }

  if (!serviceSelection) {
    return (
      <div className="simple-page">
        <div className="status-symbol">2</div>
        <span className="eyebrow">CHƯA CHỌN ĐIỂM ĐÓN/TRẢ</span>
        <h1>Vui lòng hoàn tất Bước 2</h1>
        <Link className="btn btn-primary" to={`/dat-ve/${tripId}`}>Chọn điểm đón/trả</Link>
      </div>
    )
  }

  if (loading) return <div className="container page-content"><LoadingState label="Đang chuẩn bị thông tin hành khách..." /></div>
  if (!detail || !serviceData) return <div className="container page-content"><ErrorState message={error} onRetry={loadTrip} /></div>

  const trip = detail.trip
  const departure = trip.departureLocation || trip.route?.departureLocation
  const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
  const routeName = trip.route?.routeName || `${departure?.name || 'Điểm đi'} → ${arrival?.name || 'Điểm đến'}`

  return (
    <div className="page-surface booking-step3-page">
      <div className="container page-content booking-step3-container">
        <BookingFlowSteps activeStep={3} />

        <div className="alert alert-info">
          <strong>Chưa giữ chỗ.</strong> Sau khi nhập xong thông tin và chuyển sang Bước 4 – Thanh toán, hệ thống mới kiểm tra lại ghế/phòng và bắt đầu giữ trong 10 phút.
        </div>

        <div className="booking-step3-layout">
          <form className="booking-step3-form-card" onSubmit={continueToPayment}>
            <h1>THÔNG TIN LIÊN HỆ ĐẶT VÉ</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            {validation && <div className="alert alert-warning">{validation}</div>}

            <label className="form-label" htmlFor="fullName">Họ và tên hành khách</label>
            <input
              className="form-control mb-3"
              id="fullName"
              name="fullName"
              value={passenger.fullName}
              onChange={updatePassenger}
              maxLength="100"
              placeholder="Ví dụ: Nguyễn Văn A"
              required
            />

            <label className="form-label" htmlFor="email">Email nhận vé</label>
            <input
              className="form-control mb-3"
              id="email"
              name="email"
              type="email"
              value={passenger.email}
              onChange={updatePassenger}
              maxLength="255"
              placeholder="Ví dụ: email@gmail.com"
              required
            />

            <label className="form-label" htmlFor="phone">Số điện thoại liên hệ</label>
            <input
              className="form-control mb-3"
              id="phone"
              name="phone"
              type="tel"
              value={passenger.phone}
              onChange={updatePassenger}
              maxLength="12"
              placeholder="Ví dụ: 0901234567"
              required
            />

            <label className="form-label" htmlFor="customerNote">Ghi chú <span className="text-muted">(không bắt buộc)</span></label>
            <textarea
              className="form-control"
              id="customerNote"
              maxLength="500"
              onChange={(event) => setCustomerNote(event.target.value)}
              rows="3"
              value={customerNote}
              placeholder="VD: cần ghế gần cửa sổ, cần hỗ trợ hành lý..."
            />

            <section className="booking-step3-itinerary">
              <div className="booking-step3-itinerary-header">
                <div>
                  <span className="booking-step3-itinerary-eyebrow">CHI TIẾT VÉ ĐẶT</span>
                  <h2>{routeName}</h2>
                </div>
                <div className="booking-step3-itinerary-price">
                  <span>Tổng tạm tính</span>
                  <strong>{formatCurrency(seatDraft.totalAmount)}</strong>
                </div>
              </div>

              <div className="booking-step3-itinerary-meta">
                <div>
                  <span>Khởi hành</span>
                  <strong>{formatDateTime(trip.departureTime)}</strong>
                </div>
                <div>
                  <span>Xe</span>
                  <strong>{getBusTypeLabel(trip.bus.busType)}</strong>
                  <small>Biển số {formatLicensePlate(trip.bus.licensePlate)}</small>
                </div>
                <div>
                  <span>Ghế/Phòng</span>
                  <strong>{seatDescriptions}</strong>
                </div>
              </div>

              <div className="booking-step3-service-grid">
                <article className="booking-step3-service-card is-pickup">
                  <div className="booking-step3-service-badge">ĐÓN</div>
                  <div>
                    <span>Điểm đón</span>
                    <h3>{serviceSummary.pickup.title}</h3>
                    <p>{serviceSummary.pickup.serviceLabel}</p>
                    {serviceSummary.pickup.detail && <small>{serviceSummary.pickup.detail}</small>}
                    {serviceSummary.pickup.time && <b>{serviceSummary.pickup.time}</b>}
                  </div>
                </article>

                <article className="booking-step3-service-card is-dropoff">
                  <div className="booking-step3-service-badge">TRẢ</div>
                  <div>
                    <span>Điểm trả</span>
                    <h3>{serviceSummary.dropoff.title}</h3>
                    <p>{serviceSummary.dropoff.serviceLabel}</p>
                    {serviceSummary.dropoff.detail && <small>{serviceSummary.dropoff.detail}</small>}
                    {serviceSummary.dropoff.time && <b>{serviceSummary.dropoff.time}</b>}
                  </div>
                </article>
              </div>
            </section>

            <div className="booking-step3-actions">
              <button className="btn btn-outline-secondary" onClick={() => navigate(`/dat-ve/${tripId}`)} type="button">← Quay lại Bước 2</button>
              <button className="btn btn-primary" disabled={leaving} type="submit">Tiếp tục thanh toán →</button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}

export default BookingPage
