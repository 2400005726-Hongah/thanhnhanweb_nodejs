import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import BookingFlowSteps from '../components/booking/BookingFlowSteps.jsx'
import { validateServiceSelection } from '../components/booking/BookingServicePointFields.jsx'
import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import { useAuth } from '../contexts/authContext.js'
import { createBooking, holdSeats, releaseSeatHold } from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripDetail, getTripServicePoints } from '../services/publicTrip.service.js'
import {
  clearSeatHold,
  getOrCreateSeatHoldToken,
  getSeatHold,
  saveBookingResult,
  saveSeatHold,
} from '../utils/bookingSession.js'
import {
  clearBookingFlowDrafts,
  getBookingPassengerDraft,
  getBookingSeatDraft,
} from '../utils/bookingFlowDraft.js'
import {
  clearBookingServiceSelection,
  getBookingServiceSelection,
  getSelectedServiceSummary,
} from '../utils/bookingServiceSelection.js'
import { getBusTypeLabel, getSeatTypeLabel } from '../utils/busTypes.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import { getPaymentMethodLabel, getPaymentOptionsForSource } from '../utils/paymentLabels.js'
import { formatBookingCode, formatLicensePlate } from '../utils/normalizers.js'
import paymentQrDemo from '../assets/payment-qr-demo.svg'

import './BookingPaymentPage.css'

const HOLD_REQUESTS = new Map()

const getRemainingSeconds = (expiresAt) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))

const formatCountdown = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

const getSeatDraftIds = (seatDraft) =>
  (seatDraft?.seats || []).map((seat) => seat.id).filter(Boolean)

const acquireHold = (tripId, seatDraft, holdToken) => {
  const requestKey = `${tripId}:${holdToken}`
  if (HOLD_REQUESTS.has(requestKey)) return HOLD_REQUESTS.get(requestKey)
  const request = holdSeats(
    tripId,
    seatDraft.seats.map((seat) => seat.id),
    seatDraft.roomSelections || [],
    holdToken,
  ).finally(() => HOLD_REQUESTS.delete(requestKey))
  HOLD_REQUESTS.set(requestKey, request)
  return request
}

function BookingPaymentPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [seatDraft] = useState(() => getBookingSeatDraft(tripId))
  const [serviceSelection] = useState(() => getBookingServiceSelection(tripId))
  const [passengerDraft] = useState(() => getBookingPassengerDraft(tripId))
  const [detail, setDetail] = useState(null)
  const [servicePoints, setServicePoints] = useState(null)
  const [hold, setHold] = useState(() => {
    const existing = getSeatHold(tripId, getSeatDraftIds(seatDraft))
    return existing && getRemainingSeconds(existing.holdExpiresAt) > 0 ? existing : null
  })
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const existing = getSeatHold(tripId, getSeatDraftIds(seatDraft))
    return existing ? getRemainingSeconds(existing.holdExpiresAt) : 0
  })
  const [paymentMethod, setPaymentMethod] = useState('BANK_QR')
  const [loading, setLoading] = useState(true)
  const [holding, setHolding] = useState(!hold)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [holdConflict, setHoldConflict] = useState(false)
  const [holdAttempt, setHoldAttempt] = useState(0)
  const [showPaymentQr, setShowPaymentQr] = useState(false)
  const initializedRef = useRef(false)
  const bookingSubmitRef = useRef(false)

  const prerequisitesReady = Boolean(seatDraft && serviceSelection && passengerDraft)

  const load = useCallback(async () => {
    if (!prerequisitesReady) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [tripDetail, servicePointData] = await Promise.all([
        getTripDetail(tripId),
        getTripServicePoints(tripId),
      ])
      setDetail(tripDetail)
      setServicePoints(servicePointData)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [prerequisitesReady, tripId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!prerequisitesReady || hold || initializedRef.current) return

    const seatIds = getSeatDraftIds(seatDraft)
    const sharedHold = getSeatHold(tripId, seatIds)
    if (sharedHold && getRemainingSeconds(sharedHold.holdExpiresAt) > 0) {
      setHold(sharedHold)
      setRemainingSeconds(getRemainingSeconds(sharedHold.holdExpiresAt))
      setHolding(false)
      setHoldConflict(false)
      setError('')
      return
    }

    initializedRef.current = true
    setHolding(true)
    setHoldConflict(false)
    setError('')

    const clientHoldToken = getOrCreateSeatHoldToken(tripId, seatIds)

    acquireHold(tripId, seatDraft, clientHoldToken)
      .then((newHold) => {
        saveSeatHold(tripId, newHold)
        setHold(newHold)
        setRemainingSeconds(getRemainingSeconds(newHold.holdExpiresAt))
      })
      .catch((requestError) => {
        const conflict = requestError.response?.status === 409

        if (conflict) {
          const reusedHold = getSeatHold(tripId, seatIds)
          if (reusedHold && getRemainingSeconds(reusedHold.holdExpiresAt) > 0) {
            setHold(reusedHold)
            setRemainingSeconds(getRemainingSeconds(reusedHold.holdExpiresAt))
            setHoldConflict(false)
            setError('')
            return
          }
        }

        setHoldConflict(conflict)
        if (!conflict) initializedRef.current = false
        setError(
          conflict
            ? 'Ghế/phòng đã được giữ ở một phiên hoặc tab khác, hoặc vừa được khách khác chọn. Hãy đóng các tab đặt vé trùng, kiểm tra lại vị trí hoặc quay lại Bước 1.'
            : getApiErrorMessage(requestError),
        )
      })
      .finally(() => setHolding(false))
  }, [hold, holdAttempt, prerequisitesReady, seatDraft, tripId])

  useEffect(() => {
    if (!hold) return undefined
    const update = () => setRemainingSeconds(getRemainingSeconds(hold.holdExpiresAt))
    update()
    const intervalId = window.setInterval(update, 1000)
    return () => window.clearInterval(intervalId)
  }, [hold])

  useEffect(() => {
    if (!hold || remainingSeconds > 0) return
    clearSeatHold(tripId, getSeatDraftIds(seatDraft))
    setHold(null)
    setError('Đã hết 10 phút giữ chỗ. Vui lòng quay lại Bước 1 và chọn lại ghế/phòng.')
    setHoldConflict(true)
    void releaseSeatHold(tripId, hold.holdToken).catch(() => {})
  }, [hold, remainingSeconds, tripId])

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

  const seatDescriptions = useMemo(
    () => seatDraft?.seats?.map((seat) => `${seat.seatCode} · ${getSeatTypeLabel(seat.seatType)}`).join(', ') || '',
    [seatDraft],
  )

  const releaseCurrentHold = async () => {
    const seatIds = getSeatDraftIds(seatDraft)
    const activeHold = hold || getSeatHold(tripId, seatIds)
    clearSeatHold(tripId, seatIds)
    setHold(null)
    if (activeHold?.holdToken) {
      try {
        await releaseSeatHold(tripId, activeHold.holdToken)
      } catch {
        // Hold có thể đã hết hạn.
      }
    }
  }

  const backToPassenger = async () => {
    if (submitting) return
    setSubmitting(true)
    await releaseCurrentHold()
    navigate(`/dat-ve/${tripId}/thong-tin`)
  }

  const cancelFlow = async () => {
    if (submitting) return
    setSubmitting(true)
    await releaseCurrentHold()
    clearBookingServiceSelection(tripId)
    clearBookingFlowDrafts(tripId)
    navigate(`/chuyen-xe/${tripId}`)
  }

  const completeBooking = async () => {
    if (
      !hold ||
      remainingSeconds <= 0 ||
      submitting ||
      bookingSubmitRef.current ||
      !detail ||
      !serviceData
    ) return

    const serviceMessage = validateServiceSelection(serviceData, serviceSelection)
    if (serviceMessage) {
      setError(`${serviceMessage} Vui lòng quay lại Bước 2 để chọn lại điểm đón/trả.`)
      return
    }

    bookingSubmitRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const data = await createBooking({
        tripId,
        holdToken: hold.holdToken,
        roomSelections: seatDraft.roomSelections || [],
        passenger: passengerDraft.passenger,
        pickupKind: serviceSelection.pickupKind,
        dropoffKind: serviceSelection.dropoffKind,
        pickupServicePointId: serviceSelection.pickupServicePointId || undefined,
        dropoffServicePointId: serviceSelection.dropoffServicePointId || undefined,
        pickupRequestedAddress:
          serviceSelection.pickupRequestedAddress || undefined,
        dropoffRequestedAddress:
          serviceSelection.dropoffRequestedAddress || undefined,
        customerNote: passengerDraft.customerNote || undefined,
        paymentMethod,
      })

      clearSeatHold(tripId, getSeatDraftIds(seatDraft))
      clearBookingServiceSelection(tripId)
      clearBookingFlowDrafts(tripId)
      saveBookingResult(data.booking)
      if (['ADMIN', 'STAFF'].includes(user?.role)) {
        navigate('/admin/ve-xe', {
          replace: true,
          state: {
            notice: `Đã tạo vé Online ${formatBookingCode(data.booking.bookingCode)} thành công.`,
            bookingCode: data.booking.bookingCode,
          },
        })
      } else {
        navigate(`/dat-ve-thanh-cong/${data.booking.bookingCode}`, {
          replace: true,
          state: { booking: data.booking },
        })
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
      if (requestError.response?.status === 409) {
        clearSeatHold(tripId, getSeatDraftIds(seatDraft))
        setHold(null)
        setShowPaymentQr(false)
        setHoldConflict(true)
      }
    } finally {
      bookingSubmitRef.current = false
      setSubmitting(false)
    }
  }

  const submitPayment = async (event) => {
    event.preventDefault()
    if (!hold || remainingSeconds <= 0 || submitting || !detail || !serviceData) return

    const serviceMessage = validateServiceSelection(serviceData, serviceSelection)
    if (serviceMessage) {
      setError(`${serviceMessage} Vui lòng quay lại Bước 2 để chọn lại điểm đón/trả.`)
      return
    }

    setError('')

    if (paymentMethod === 'PAY_AT_BUS') {
      await completeBooking()
      return
    }

    setShowPaymentQr(true)
  }

  const confirmTransferred = async () => {
    if (!showPaymentQr || paymentMethod === 'PAY_AT_BUS') return
    await completeBooking()
  }


  if (!seatDraft) {
    return <div className="simple-page"><div className="status-symbol">1</div><h1>Vui lòng chọn chỗ trước</h1><Link className="btn btn-primary" to={`/chuyen-xe/${tripId}`}>Bước 1 – Chọn chỗ</Link></div>
  }
  if (!serviceSelection) {
    return <div className="simple-page"><div className="status-symbol">2</div><h1>Vui lòng chọn điểm đón/trả</h1><Link className="btn btn-primary" to={`/dat-ve/${tripId}`}>Bước 2</Link></div>
  }
  if (!passengerDraft) {
    return <div className="simple-page"><div className="status-symbol">3</div><h1>Vui lòng nhập thông tin hành khách</h1><Link className="btn btn-primary" to={`/dat-ve/${tripId}/thong-tin`}>Bước 3</Link></div>
  }
  if (loading) return <div className="container page-content"><LoadingState label="Đang chuẩn bị bước thanh toán..." /></div>
  if (!detail || !serviceData) return <div className="container page-content"><ErrorState message={error} onRetry={load} /></div>

  const trip = detail.trip
  const departure = trip.departureLocation || trip.route?.departureLocation
  const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
  const routeName = trip.route?.routeName || `${departure?.name || 'Điểm đi'} → ${arrival?.name || 'Điểm đến'}`
  const expired = hold && remainingSeconds <= 0
  const isPayAtBus = paymentMethod === 'PAY_AT_BUS'
  const paymentAmount = hold?.totalAmount ?? seatDraft.totalAmount
  const paymentReference = `THANHNHAN ${passengerDraft.passenger.phone.slice(-4)} ${String(tripId).slice(0, 6).toUpperCase()}`

  return (
    <div className="page-surface booking-payment-page">
      <div className="container page-content booking-payment-container">
        <BookingFlowSteps activeStep={4} />

        <div className="booking-payment-hold-banner">
          <div>
            <span>BẮT ĐẦU GIỮ CHỖ TẠI BƯỚC THANH TOÁN</span>
            <strong>{holding ? 'Đang kiểm tra và giữ ghế/phòng...' : hold ? 'Ghế/phòng đang được giữ cho bạn' : 'Chưa giữ được chỗ'}</strong>
          </div>
          <b className={remainingSeconds <= 120 && hold ? 'is-urgent' : ''}>
            {hold ? formatCountdown(remainingSeconds) : '--:--'}
          </b>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {holdConflict ? (
          <div className="booking-payment-conflict-card">
            <h1>Vị trí đang được giữ ở phiên khác</h1>
            <p>
              Ghế/phòng bạn chọn hiện đang được giữ hoặc đã được đặt. Nếu bạn đang mở cùng quy trình đặt vé ở tab khác,
              hãy hoàn tất hoặc đóng tab đó trước. Hệ thống sẽ không tự ý lấy chỗ đang được giữ của khách khác.
            </p>
            <div className="booking-payment-conflict-actions">
              <button
                className="btn btn-outline-primary"
                onClick={() => {
                  initializedRef.current = false
                  setHoldConflict(false)
                  setError('')
                  setHoldAttempt((current) => current + 1)
                }}
                type="button"
              >
                Kiểm tra lại vị trí
              </button>
              <Link className="btn btn-primary" to={`/chuyen-xe/${tripId}`}>← Quay lại Bước 1</Link>
            </div>
          </div>
        ) : (
          <div className="booking-payment-layout">
            <form className="booking-payment-card" onSubmit={submitPayment}>
              <span className="eyebrow">BƯỚC 4</span>
              <h1>Thanh toán và xác nhận vé</h1>
              <p>Thời gian giữ ghế/phòng được tính từ lúc bạn vào bước này.</p>

              {!hold && !holding && !holdConflict && (
                <button
                  className="btn btn-outline-primary mb-3"
                  onClick={() => {
                    initializedRef.current = false
                    setHoldAttempt((current) => current + 1)
                  }}
                  type="button"
                >
                  Thử giữ chỗ lại
                </button>
              )}

              <label className="form-label" htmlFor="paymentMethod">Phương thức thanh toán</label>
              <select
                className="form-select"
                id="paymentMethod"
                onChange={(event) => {
                  setPaymentMethod(event.target.value)
                  setShowPaymentQr(false)
                  setError('')
                }}
                value={paymentMethod}
                disabled={!hold || expired || submitting}
                required
              >
                {getPaymentOptionsForSource('ONLINE').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <div className="booking-payment-note">
                {isPayAtBus
                  ? 'Vé sẽ được xác nhận và giữ ghế; quý khách thanh toán khi lên xe.'
                  : 'Nhấn “Thanh toán” để mở QR minh họa. Vé chỉ được tạo sau khi bạn bấm “Xác nhận tôi đã chuyển khoản”.'}
              </div>

              {showPaymentQr && !isPayAtBus && (
                <section className="booking-payment-qr-panel" aria-live="polite">
                  <div className="booking-payment-qr-heading">
                    <div>
                      <span>THANH TOÁN MÔ PHỎNG</span>
                      <h2>Quét QR để thanh toán</h2>
                    </div>
                    <b>{formatCountdown(remainingSeconds)}</b>
                  </div>

                  <div className="booking-payment-qr-content">
                    <div className="booking-payment-qr-image">
                      <img src={paymentQrDemo} alt="QR thanh toán minh họa Nhà xe Thành Nhân" />
                      <small>QR minh họa · Không dùng để chuyển tiền thật</small>
                    </div>

                    <div className="booking-payment-qr-info">
                      <div><span>Phương thức</span><strong>{getPaymentMethodLabel(paymentMethod)}</strong></div>
                      <div><span>Người nhận</span><strong>NHÀ XE THÀNH NHÂN</strong></div>
                      <div><span>Số tiền</span><strong className="is-amount">{formatCurrency(paymentAmount)}</strong></div>
                      <div><span>Nội dung</span><strong>{paymentReference}</strong></div>
                    </div>
                  </div>

                  <div className="booking-payment-qr-warning">
                    Đây là QR minh họa phục vụ đồ án. Sau khi mô phỏng chuyển khoản, bấm nút xác nhận bên dưới để hoàn tất đặt vé.
                  </div>

                  <button
                    className="btn btn-success btn-lg w-100 booking-payment-confirm-transfer"
                    disabled={!hold || expired || submitting || holding}
                    onClick={confirmTransferred}
                    type="button"
                  >
                    {submitting ? 'Đang xác nhận và tạo vé...' : '✓ Xác nhận tôi đã chuyển khoản'}
                  </button>
                </section>
              )}

              <div className="booking-payment-actions">
                <button className="btn btn-outline-secondary" disabled={submitting} onClick={backToPassenger} type="button">← Quay lại Bước 3</button>
                {!showPaymentQr && (
                  <button className="btn btn-primary btn-lg" disabled={!hold || expired || submitting || holding} type="submit">
                    {submitting
                      ? 'Đang xử lý...'
                      : isPayAtBus
                        ? 'Xác nhận đặt vé'
                        : 'Thanh toán'}
                  </button>
                )}
                {showPaymentQr && !isPayAtBus && (
                  <button className="btn btn-outline-primary" disabled={submitting} onClick={() => setShowPaymentQr(false)} type="button">
                    Đổi phương thức thanh toán
                  </button>
                )}
              </div>
              <button className="btn btn-link text-danger w-100 mt-2" disabled={submitting} onClick={cancelFlow} type="button">Hủy quy trình đặt vé</button>
            </form>

            <aside className="booking-payment-summary">
              <h2>Chi tiết vé đặt</h2>
              <div><span>Hành trình</span><strong>{routeName}</strong></div>
              <div><span>Khởi hành</span><strong>{formatDateTime(trip.departureTime)}</strong></div>
              <div><span>Xe</span><strong>{getBusTypeLabel(trip.bus.busType)}</strong><small>{formatLicensePlate(trip.bus.licensePlate)}</small></div>
              <div><span>Ghế/Phòng</span><strong>{seatDescriptions}</strong></div>
              <div className="is-pickup"><span>Điểm đón</span><strong>{serviceSummary.pickup.title}</strong><small>{serviceSummary.pickup.serviceLabel}</small><small>{serviceSummary.pickup.detail}</small>{serviceSummary.pickup.time && <small>{serviceSummary.pickup.time}</small>}</div>
              <div className="is-dropoff"><span>Điểm trả</span><strong>{serviceSummary.dropoff.title}</strong><small>{serviceSummary.dropoff.serviceLabel}</small><small>{serviceSummary.dropoff.detail}</small>{serviceSummary.dropoff.time && <small>{serviceSummary.dropoff.time}</small>}</div>
              <div><span>Hành khách</span><strong>{passengerDraft.passenger.fullName}</strong><small>{passengerDraft.passenger.phone}</small></div>
              <div className="booking-payment-total"><span>Tổng tiền máy chủ</span><strong>{formatCurrency(hold?.totalAmount ?? seatDraft.totalAmount)}</strong></div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

export default BookingPaymentPage
