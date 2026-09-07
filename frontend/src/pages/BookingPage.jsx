import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

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
  const [seatDraft] = useState(() => getBookingSeatDraft(tripId))
  const [serviceSelection] = useState(() => getBookingServiceSelection(tripId))
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
        <Link className="btn btn-primary" to="/tim-chuyen">Quay lại chọn chỗ</Link>
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

        <div className="booking-step3-hold-note">
          <strong>Chưa giữ chỗ.</strong>
          <span>Ghế/phòng chỉ bắt đầu được giữ 10 phút khi chuyển sang Bước 4 – Thanh toán.</span>
        </div>

        <div className="booking-step3-layout">
          <form className="booking-step3-form-card" onSubmit={continueToPayment}>
            <div className="booking-step3-form-heading">
              <span>BƯỚC 3</span>
              <h1>Thông tin liên hệ đặt vé</h1>
              <p>Vui lòng nhập chính xác thông tin để nhận vé điện tử và hỗ trợ khi cần.</p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {validation && <div className="alert alert-warning">{validation}</div>}

            <div className="booking-step3-fields">
              <label>
                <span>Họ và tên hành khách</span>
                <input
                  className="form-control"
                  id="fullName"
                  name="fullName"
                  value={passenger.fullName}
                  onChange={updatePassenger}
                  maxLength="100"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required
                />
              </label>

              <label>
                <span>Email nhận vé</span>
                <input
                  className="form-control"
                  id="email"
                  name="email"
                  type="email"
                  value={passenger.email}
                  onChange={updatePassenger}
                  maxLength="255"
                  placeholder="Ví dụ: email@gmail.com"
                  required
                />
              </label>

              <label>
                <span>Số điện thoại liên hệ</span>
                <input
                  className="form-control"
                  id="phone"
                  name="phone"
                  type="tel"
                  value={passenger.phone}
                  onChange={updatePassenger}
                  maxLength="12"
                  placeholder="Ví dụ: 0901234567"
                  required
                />
              </label>

              <label>
                <span>Ghi chú <small>(không bắt buộc)</small></span>
                <textarea
                  className="form-control"
                  id="customerNote"
                  maxLength="500"
                  onChange={(event) => setCustomerNote(event.target.value)}
                  rows="4"
                  value={customerNote}
                  placeholder="VD: cần ghế gần cửa sổ, cần hỗ trợ hành lý..."
                />
              </label>
            </div>

            <div className="booking-step3-actions">
              <button
                className="btn btn-outline-secondary"
                onClick={() => navigate(`/dat-ve/${tripId}`)}
                type="button"
              >
                ← Quay lại Bước 2
              </button>
              <button className="btn btn-primary" disabled={leaving} type="submit">
                {leaving ? 'Đang chuyển...' : 'Tiếp tục thanh toán →'}
              </button>
            </div>
          </form>

          <aside className="booking-step3-ticket-card">
            <div className="booking-step3-ticket-head">
              <div>
                <span>CHI TIẾT VÉ ĐẶT</span>
                <h2>{routeName}</h2>
              </div>
              <div className="booking-step3-ticket-price">
                <small>Tổng tạm tính</small>
                <strong>{formatCurrency(seatDraft.totalAmount)}</strong>
              </div>
            </div>

            <div className="booking-step3-ticket-row">
              <span>Khởi hành</span>
              <strong>{formatDateTime(trip.departureTime)}</strong>
            </div>

            <div className="booking-step3-ticket-row">
              <span>Xe</span>
              <strong>{getBusTypeLabel(trip.bus.busType)}</strong>
              <small>Biển số {formatLicensePlate(trip.bus.licensePlate)}</small>
            </div>

            <div className="booking-step3-ticket-row">
              <span>Ghế/Phòng</span>
              <strong>{seatDescriptions}</strong>
            </div>

            <div className="booking-step3-ticket-service is-pickup">
              <span>Điểm đón</span>
              <strong>{serviceSummary.pickup.title}</strong>
              <small>{serviceSummary.pickup.serviceLabel}</small>
              {serviceSummary.pickup.detail && <small>{serviceSummary.pickup.detail}</small>}
              {serviceSummary.pickup.time && <b>{serviceSummary.pickup.time}</b>}
            </div>

            <div className="booking-step3-ticket-service is-dropoff">
              <span>Điểm trả</span>
              <strong>{serviceSummary.dropoff.title}</strong>
              <small>{serviceSummary.dropoff.serviceLabel}</small>
              {serviceSummary.dropoff.detail && <small>{serviceSummary.dropoff.detail}</small>}
              {serviceSummary.dropoff.time && <b>{serviceSummary.dropoff.time}</b>}
            </div>

            <div className="booking-step3-ticket-total">
              <span>Tổng tiền vé</span>
              <strong>{formatCurrency(seatDraft.totalAmount)}</strong>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default BookingPage
