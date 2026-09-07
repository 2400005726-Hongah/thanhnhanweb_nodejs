import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import BookingFlowSteps from '../components/booking/BookingFlowSteps.jsx'
import BookingServicePointFields, {
  createDefaultServiceSelection,
  validateServiceSelection,
} from '../components/booking/BookingServicePointFields.jsx'
import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripDetail, getTripServicePoints } from '../services/publicTrip.service.js'
import { getBookingSeatDraft } from '../utils/bookingFlowDraft.js'
import {
  getBookingServiceSelection,
  getSelectedServiceSummary,
  saveBookingServiceSelection,
} from '../utils/bookingServiceSelection.js'
import { getSeatTypeLabel } from '../utils/busTypes.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'

import './BookingServicePointPage.css'

function BookingServicePointPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [seatDraft] = useState(() => getBookingSeatDraft(tripId))
  const [detail, setDetail] = useState(null)
  const [servicePoints, setServicePoints] = useState(null)
  const [selection, setSelection] = useState(
    () => getBookingServiceSelection(tripId) || createDefaultServiceSelection(),
  )
  const [loading, setLoading] = useState(Boolean(seatDraft))
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const [leaving, setLeaving] = useState(false)

  const backToSeatSelection = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/tim-chuyen')
  }

  const load = useCallback(async () => {
    if (!seatDraft) return
    setLoading(true)
    setError('')
    try {
      const [tripDetail, servicePointData] = await Promise.all([
        getTripDetail(tripId),
        getTripServicePoints(tripId),
      ])
      setDetail(tripDetail)
      setServicePoints(servicePointData)
      setSelection(
        getBookingServiceSelection(tripId) ||
          createDefaultServiceSelection(servicePointData),
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [seatDraft, tripId])

  useEffect(() => {
    load()
  }, [load])

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

  const selectedServiceSummary = useMemo(
    () => getSelectedServiceSummary(serviceData, selection),
    [serviceData, selection],
  )

  const seatDescriptions = useMemo(
    () => seatDraft?.seats?.map((seat) => `${seat.seatCode} · ${getSeatTypeLabel(seat.seatType)}`).join(', ') || '',
    [seatDraft],
  )

  const continueToPassenger = () => {
    const message = validateServiceSelection(serviceData, selection)
    if (message) {
      setValidation(message)
      return
    }

    saveBookingServiceSelection(tripId, selection)
    setLeaving(true)
    navigate(`/dat-ve/${tripId}/thong-tin`)
  }

  if (!seatDraft) {
    return (
      <div className="simple-page">
        <div className="status-symbol">1</div>
        <span className="eyebrow">CHƯA CHỌN CHỖ</span>
        <h1>Vui lòng hoàn tất Bước 1</h1>
        <p>Hãy chọn ghế/phòng trước khi chọn điểm đón và điểm trả.</p>
        <button className="btn btn-primary" onClick={backToSeatSelection} type="button">Quay lại chọn chỗ</button>
      </div>
    )
  }

  if (loading) {
    return <div className="container page-content"><LoadingState label="Đang tải các phương án đón/trả..." /></div>
  }

  if (!detail || !serviceData) {
    return <div className="container page-content"><ErrorState message={error} onRetry={load} /></div>
  }

  const trip = detail.trip
  const departure = trip.departureLocation || trip.route?.departureLocation
  const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
  const routeName = trip.route?.routeName || `${departure?.name || 'Điểm đi'} → ${arrival?.name || 'Điểm đến'}`

  return (
    <div className="page-surface booking-service-step-page">
      <div className="container page-content booking-service-step-container">
        <BookingFlowSteps activeStep={2} />

        <div className="booking-service-rule-note">
          <strong>ⓘ Vui lòng chọn nơi bạn sẽ lên xe và xuống xe</strong>
          <span>
            Nhà xe chỉ hiển thị các địa điểm phục vụ đang hoạt động của chuyến.
            Mỗi vé chọn đúng 1 điểm đón và 1 điểm trả; hình thức phục vụ đi cùng với địa điểm đã chọn.
          </span>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {validation && <div className="alert alert-warning">{validation}</div>}

        <div className="booking-service-step-layout">
          <main>
            <BookingServicePointFields
              serviceData={serviceData}
              selection={selection}
              onChange={(next) => {
                setValidation('')
                setSelection(next)
              }}
            />
          </main>

          <aside className="booking-step-summary-card">
            <h2>Chi tiết vé đặt</h2>
            <div className="booking-step-summary-block"><span>Hành trình chính</span><strong>{routeName}</strong></div>
            <div className="booking-step-summary-grid">
              <div><span>Khởi hành</span><strong>{formatDateTime(trip.departureTime)}</strong></div>
              <div><span>Ghế/Phòng</span><strong>{seatDescriptions}</strong></div>
            </div>
            <div className="booking-step-selected-service is-pickup">
              <span>Phương án đón</span>
              <strong>{selectedServiceSummary.pickup.title}</strong>
              <small>{selectedServiceSummary.pickup.detail}</small>
              {selectedServiceSummary.pickup.time && (
                <b>{selectedServiceSummary.pickup.time}</b>
              )}
              <em>{selectedServiceSummary.pickup.serviceLabel}</em>
            </div>
            <div className="booking-step-selected-service is-dropoff">
              <span>Phương án trả</span>
              <strong>{selectedServiceSummary.dropoff.title}</strong>
              <small>{selectedServiceSummary.dropoff.detail}</small>
              {selectedServiceSummary.dropoff.time && (
                <b>{selectedServiceSummary.dropoff.time}</b>
              )}
              <em>{selectedServiceSummary.dropoff.serviceLabel}</em>
            </div>
            <div className="booking-step-summary-total"><span>Tổng tạm tính</span><strong>{formatCurrency(seatDraft.totalAmount)}</strong></div>
            <button className="btn btn-primary w-100" disabled={leaving} onClick={continueToPassenger} type="button">
              Xác nhận và tiếp tục →
            </button>
            <button className="btn btn-link w-100 mt-2" disabled={leaving} onClick={backToSeatSelection} type="button">
              Quay lại chọn chỗ
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default BookingServicePointPage
