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
import bankLogo from '../assets/payment-logos/bank.svg'
import bankQrLogo from '../assets/payment-logos/bank-qr.svg'
import momoLogo from '../assets/payment-logos/momo.svg'
import zalopayLogo from '../assets/payment-logos/zalopay.svg'
import vnpayLogo from '../assets/payment-logos/vnpay.svg'
import payAtBusLogo from '../assets/payment-logos/pay-at-bus.svg'

import './BookingPaymentPage.css'

const HOLD_REQUESTS = new Map()

const getRemainingSeconds = (expiresAt) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))

const formatCountdown = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

const PAYMENT_UI_META = Object.freeze({
  BANK_TRANSFER: {
    logo: bankLogo,
    shortLabel: 'Chuyển khoản',
    description: 'Chuyển khoản nhanh qua ứng dụng ngân hàng hoặc Internet Banking.',
    qrTitle: 'Chuyển khoản ngân hàng',
    qrDescription: 'Quét QR để điền nhanh thông tin chuyển khoản.',
    steps: [
      'Mở ứng dụng ngân hàng hoặc Internet Banking.',
      'Quét mã QR và kiểm tra người nhận, số tiền.',
      'Hoàn tất giao dịch rồi bấm “Tôi đã chuyển khoản”.',
    ],
  },
  BANK_QR: {
    logo: bankQrLogo,
    shortLabel: 'QR ngân hàng',
    description: 'Quét mã QR bằng ứng dụng ngân hàng có hỗ trợ VietQR/NAPAS.',
    qrTitle: 'Thanh toán bằng QR ngân hàng',
    qrDescription: 'Thông tin người nhận và số tiền được điền sẵn trên QR minh họa.',
    steps: [
      'Mở ứng dụng ngân hàng và chọn chức năng Quét QR.',
      'Quét mã bên dưới, kiểm tra số tiền và nội dung.',
      'Xác nhận thanh toán rồi quay lại website để hoàn tất.',
    ],
  },
  MOMO: {
    logo: momoLogo,
    shortLabel: 'Ví MoMo',
    description: 'Thanh toán bằng ví MoMo qua mã QR.',
    qrTitle: 'Thanh toán bằng MoMo',
    qrDescription: 'Mở MoMo và sử dụng chức năng quét mã để thanh toán.',
    steps: [
      'Mở ứng dụng MoMo và chọn Quét mã.',
      'Quét QR, kiểm tra số tiền và nội dung thanh toán.',
      'Xác nhận trên MoMo rồi bấm nút hoàn tất bên dưới.',
    ],
  },
  ZALOPAY: {
    logo: zalopayLogo,
    shortLabel: 'ZaloPay',
    description: 'Thanh toán nhanh bằng ví ZaloPay.',
    qrTitle: 'Thanh toán bằng ZaloPay',
    qrDescription: 'Quét mã QR bằng ứng dụng ZaloPay.',
    steps: [
      'Mở ZaloPay và chọn chức năng Quét mã.',
      'Quét QR, kiểm tra thông tin giao dịch.',
      'Xác nhận thanh toán rồi trở lại website.',
    ],
  },
  VNPAY: {
    logo: vnpayLogo,
    shortLabel: 'VNPAY',
    description: 'Quét VNPAY-QR bằng ứng dụng ngân hàng hoặc ví hỗ trợ.',
    qrTitle: 'Thanh toán qua VNPAY',
    qrDescription: 'Sử dụng ứng dụng ngân hàng/đối tác hỗ trợ VNPAY-QR.',
    steps: [
      'Mở ứng dụng ngân hàng hoặc ví có hỗ trợ VNPAY-QR.',
      'Quét mã, kiểm tra người nhận và số tiền.',
      'Hoàn tất giao dịch rồi xác nhận đã chuyển khoản.',
    ],
  },
  PAY_AT_BUS: {
    logo: payAtBusLogo,
    shortLabel: 'Thanh toán tại nhà xe',
    description: 'Đặt vé trước, thanh toán trực tiếp khi lên xe theo quy định nhà xe.',
    qrTitle: '',
    qrDescription: '',
    steps: [],
  },
})

const getPaymentUiMeta = (method) =>
  PAYMENT_UI_META[method] || {
    logo: bankQrLogo,
    shortLabel: getPaymentMethodLabel(method),
    description: 'Thanh toán theo phương thức đã chọn.',
    qrTitle: getPaymentMethodLabel(method),
    qrDescription: 'Quét mã QR để tiếp tục thanh toán.',
    steps: [
      'Mở ứng dụng thanh toán phù hợp.',
      'Quét mã QR và kiểm tra thông tin.',
      'Hoàn tất giao dịch rồi xác nhận bên dưới.',
    ],
  }

const acquireHold = (tripId, seatDraft) => {
  if (HOLD_REQUESTS.has(tripId)) return HOLD_REQUESTS.get(tripId)
  const request = holdSeats(
    tripId,
    seatDraft.seats.map((seat) => seat.id),
    seatDraft.roomSelections || [],
  ).finally(() => HOLD_REQUESTS.delete(tripId))
  HOLD_REQUESTS.set(tripId, request)
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
    const existing = getSeatHold(tripId)
    return existing && getRemainingSeconds(existing.holdExpiresAt) > 0 ? existing : null
  })
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const existing = getSeatHold(tripId)
    return existing ? getRemainingSeconds(existing.holdExpiresAt) : 0
  })
  const [paymentMethod, setPaymentMethod] = useState('')
  const [loading, setLoading] = useState(true)
  const [holding, setHolding] = useState(!hold)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [holdConflict, setHoldConflict] = useState(false)
  const [holdAttempt, setHoldAttempt] = useState(0)
  const [showPaymentQr, setShowPaymentQr] = useState(false)
  const initializedRef = useRef(false)

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
    initializedRef.current = true
    setHolding(true)
    setHoldConflict(false)
    setError('')

    acquireHold(tripId, seatDraft)
      .then((newHold) => {
        saveSeatHold(tripId, newHold)
        setHold(newHold)
        setRemainingSeconds(getRemainingSeconds(newHold.holdExpiresAt))
      })
      .catch((requestError) => {
        const conflict = requestError.response?.status === 409
        setHoldConflict(conflict)
        if (!conflict) initializedRef.current = false
        setError(
          requestError.response?.status === 409
            ? 'Một hoặc nhiều ghế/phòng bạn đã chọn vừa được người khác giữ hoặc đặt. Vui lòng quay lại Bước 1 để chọn vị trí khác.'
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
    clearSeatHold(tripId)
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
    const activeHold = hold || getSeatHold(tripId)
    clearSeatHold(tripId)
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
    navigate('/tim-chuyen')
  }

  const completeBooking = async () => {
    if (!hold || remainingSeconds <= 0 || submitting || !detail || !serviceData) return

    const serviceMessage = validateServiceSelection(serviceData, serviceSelection)
    if (serviceMessage) {
      setError(`${serviceMessage} Vui lòng quay lại Bước 2 để chọn lại điểm đón/trả.`)
      return
    }

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

      clearSeatHold(tripId)
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
        clearSeatHold(tripId)
        setHold(null)
        setShowPaymentQr(false)
        setHoldConflict(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitPayment = async (event) => {
    event.preventDefault()
    if (!paymentMethod || !hold || remainingSeconds <= 0 || submitting || !detail || !serviceData) return

    const serviceMessage = validateServiceSelection(serviceData, serviceSelection)
    if (serviceMessage) {
      setError(`${serviceMessage} Vui lòng quay lại Bước 2 để chọn lại điểm đón/trả.`)
      return
    }

    setError('')

    if (paymentMethod === 'PAY_AT_BUS') {
      await completeBooking()
    }
  }

  const confirmTransferred = async () => {
    if (!showPaymentQr || paymentMethod === 'PAY_AT_BUS') return
    await completeBooking()
  }


  if (!seatDraft) {
    return <div className="simple-page"><div className="status-symbol">1</div><h1>Vui lòng chọn chỗ trước</h1><Link className="btn btn-primary" to="/tim-chuyen">Bước 1 – Chọn chỗ</Link></div>
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
  const selectedPaymentMeta = getPaymentUiMeta(paymentMethod)

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
            <h1>Không thể tiếp tục với vị trí đã chọn</h1>
            <p>Do Bước 1–3 chưa giữ ghế nên vị trí có thể được khách khác chọn trước. Hãy quay lại sơ đồ và chọn vị trí đang còn trống.</p>
            <Link className="btn btn-primary" to="/tim-chuyen">← Quay lại Bước 1</Link>
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

              <div className="booking-payment-methods">
                <div className="booking-payment-methods-head">
                  <span>PHƯƠNG THỨC THANH TOÁN</span>
                  <strong>Chọn một phương thức</strong>
                </div>

                <div className="booking-payment-method-list">
                  {getPaymentOptionsForSource('ONLINE').map((option) => (
                    <label
                      className={`booking-payment-method-option ${
                        paymentMethod === option.value ? 'is-selected' : ''
                      }`}
                      key={option.value}
                    >
                      <input
                        checked={paymentMethod === option.value}
                        disabled={!hold || expired || submitting}
                        name="paymentMethod"
                        onChange={() => {
                          setPaymentMethod(option.value)
                          setShowPaymentQr(option.value !== 'PAY_AT_BUS')
                          setError('')
                        }}
                        type="radio"
                        value={option.value}
                      />
                      <span className="booking-payment-method-logo-wrap">
                        <img src={getPaymentUiMeta(option.value).logo} alt="" aria-hidden="true" />
                      </span>
                      <span className="booking-payment-method-copy">
                        <strong>{option.label}</strong>
                        <small>{getPaymentUiMeta(option.value).description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {!paymentMethod && (
                <div className="booking-payment-note">
                  Chọn phương thức thanh toán để tiếp tục.
                </div>
              )}

              {paymentMethod === 'PAY_AT_BUS' && (
                <div className="booking-payment-pay-at-bus">
                  <img src={selectedPaymentMeta.logo} alt="" aria-hidden="true" />
                  <div>
                    <strong>Thanh toán trực tiếp tại nhà xe</strong>
                    <span>Vé được tạo trước. Quý khách thanh toán khi lên xe theo hướng dẫn của nhân viên.</span>
                  </div>
                </div>
              )}

              {showPaymentQr && paymentMethod && !isPayAtBus && (
                <section className="booking-payment-qr-panel" aria-live="polite">
                  <div className="booking-payment-qr-heading">
                    <div className="booking-payment-qr-brand-title">
                      <img src={selectedPaymentMeta.logo} alt="" aria-hidden="true" />
                      <div>
                        <span>THANH TOÁN QR</span>
                        <h2>{selectedPaymentMeta.qrTitle}</h2>
                        <p>{selectedPaymentMeta.qrDescription}</p>
                      </div>
                    </div>
                    <div className="booking-payment-qr-timer">
                      <small>Thời gian còn lại</small>
                      <b>{formatCountdown(remainingSeconds)}</b>
                    </div>
                  </div>

                  <div className="booking-payment-qr-content">
                    <div className="booking-payment-qr-image">
                      <div className="booking-payment-qr-frame">
                        <img src={paymentQrDemo} alt={`QR minh họa ${getPaymentMethodLabel(paymentMethod)}`} />
                        <img className="booking-payment-qr-center-logo" src={selectedPaymentMeta.logo} alt="" aria-hidden="true" />
                      </div>
                      <small>QR minh họa – chưa kết nối cổng thanh toán thật</small>
                    </div>

                    <div className="booking-payment-qr-info">
                      <div><span>Cổng thanh toán</span><strong>{getPaymentMethodLabel(paymentMethod)}</strong></div>
                      <div><span>Người nhận</span><strong>NHÀ XE THÀNH NHÂN</strong></div>
                      <div><span>Số tiền cần thanh toán</span><strong className="is-amount">{formatCurrency(paymentAmount)}</strong></div>
                      <div><span>Nội dung chuyển khoản</span><strong className="is-reference">{paymentReference}</strong></div>
                      <div><span>Trạng thái</span><strong className="is-pending">Chưa xác nhận thanh toán</strong></div>
                    </div>
                  </div>

                  <div className="booking-payment-qr-guide-title">Hướng dẫn thanh toán</div>
                  <div className="booking-payment-qr-guide">
                    {selectedPaymentMeta.steps.map((step, index) => (
                      <div key={step}>
                        <b>{index + 1}</b>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div className="booking-payment-support-note">
                    <strong>Không quét được QR?</strong>
                    <span>Bạn có thể nhập thủ công người nhận, số tiền và nội dung chuyển khoản hiển thị bên cạnh mã QR.</span>
                  </div>

                  <button
                    className="btn btn-warning btn-lg w-100 booking-payment-confirm-transfer"
                    disabled={!hold || expired || submitting || holding}
                    onClick={confirmTransferred}
                    type="button"
                  >
                    {submitting ? 'Đang xác nhận và tạo vé...' : 'TÔI ĐÃ CHUYỂN KHOẢN'}
                  </button>
                </section>
              )}

              <div className="booking-payment-actions">
                <button
                  className="btn btn-outline-secondary"
                  disabled={submitting}
                  onClick={backToPassenger}
                  type="button"
                >
                  ← Quay lại Bước 3
                </button>

                {isPayAtBus && (
                  <button
                    className="btn btn-primary"
                    disabled={!hold || expired || submitting || holding}
                    type="submit"
                  >
                    {submitting ? 'Đang xử lý...' : 'Xác nhận đặt vé'}
                  </button>
                )}
              </div>

              <button
                className="btn btn-link text-danger w-100 mt-2"
                disabled={submitting}
                onClick={cancelFlow}
                type="button"
              >
                Hủy quy trình đặt vé
              </button>
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
