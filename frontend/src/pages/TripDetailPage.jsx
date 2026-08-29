import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import BookingFlowSteps from '../components/booking/BookingFlowSteps.jsx'
import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import RoomTypeDialog from '../components/seats/RoomTypeDialog.jsx'
import SeatMap from '../components/seats/SeatMap.jsx'
import { releaseSeatHold } from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripDetail, getTripSeats } from '../services/publicTrip.service.js'
import { clearSeatHold, getSeatHold } from '../utils/bookingSession.js'
import {
  clearBookingPassengerDraft,
  getBookingSeatDraft,
  saveBookingSeatDraft,
} from '../utils/bookingFlowDraft.js'
import { clearBookingServiceSelection } from '../utils/bookingServiceSelection.js'
import {
  getBusTypeLabel,
  getSeatTypeLabel,
  isRoomBusType,
} from '../utils/busTypes.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import { formatLicensePlate } from '../utils/normalizers.js'

const MAX_SELECTED = 6

function TripDetailPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [seatData, setSeatData] = useState(null)
  const [selected, setSelected] = useState(new Map())
  const [roomChoiceSeat, setRoomChoiceSeat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [continuing, setContinuing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  const releaseOldPaymentHold = useCallback(async () => {
    const oldHold = getSeatHold(tripId)
    if (!oldHold?.holdToken) return
    clearSeatHold(tripId)
    try {
      await releaseSeatHold(tripId, oldHold.holdToken)
    } catch {
      // Hold có thể đã hết hạn; backend sẽ tự dọn ở lần truy vấn kế tiếp.
    }
  }, [tripId])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await releaseOldPaymentHold()
      const [tripDetail, seats] = await Promise.all([
        getTripDetail(tripId),
        getTripSeats(tripId),
      ])
      setDetail(tripDetail)
      setSeatData(seats)

      const draft = getBookingSeatDraft(tripId)
      const seatById = new Map(
        (seats.floors || []).flatMap((floor) => floor.seats || []).map((seat) => [seat.id, seat]),
      )
      const restored = new Map()
      for (const draftSeat of draft?.seats || []) {
        const current = seatById.get(draftSeat.id)
        if (current?.status === 'AVAILABLE') {
          restored.set(current.id, { ...current, seatType: draftSeat.seatType, price: draftSeat.price })
        }
      }
      setSelected(restored)
      setRoomChoiceSeat(null)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [releaseOldPaymentHold, tripId])

  useEffect(() => {
    load()
  }, [load])

  const roomBus = detail ? isRoomBusType(detail.trip.bus.busType) : false

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return
    setNotice(null)

    if (selected.has(seat.id)) {
      setSelected((current) => {
        const next = new Map(current)
        next.delete(seat.id)
        return next
      })
      return
    }

    if (selected.size >= MAX_SELECTED) {
      setNotice({ type: 'warning', message: `Mỗi vé chỉ được chọn tối đa ${MAX_SELECTED} vị trí.` })
      return
    }

    if (roomBus) {
      setRoomChoiceSeat(seat)
      return
    }

    setSelected((current) => new Map(current).set(seat.id, seat))
  }

  const chooseRoomType = (roomType) => {
    if (!roomChoiceSeat || !detail) return
    const price = roomType === 'DOUBLE_ROOM'
      ? detail.trip.doubleRoomPrice
      : detail.trip.singleRoomPrice

    setSelected((current) => {
      const next = new Map(current)
      next.set(roomChoiceSeat.id, { ...roomChoiceSeat, seatType: roomType, price })
      return next
    })
    setRoomChoiceSeat(null)
  }

  const total = useMemo(
    () => [...selected.values()].reduce((sum, seat) => sum + Number(seat.price || 0), 0),
    [selected],
  )

  const roomSelections = useMemo(
    () => roomBus
      ? [...selected.values()].map((seat) => ({ tripSeatId: seat.id, roomType: seat.seatType }))
      : [],
    [roomBus, selected],
  )

  const continueBooking = () => {
    if (!selected.size || continuing) return
    setContinuing(true)
    setNotice(null)

    saveBookingSeatDraft(tripId, {
      seats: [...selected.values()],
      roomSelections,
      totalAmount: total,
    })
    clearBookingServiceSelection(tripId)
    clearBookingPassengerDraft(tripId)
    navigate(`/dat-ve/${tripId}`)
  }

  if (loading) {
    return <div className="container page-content"><LoadingState label="Đang tải thông tin chuyến và sơ đồ ghế..." /></div>
  }
  if (error || !detail || !seatData) {
    return <div className="container page-content"><ErrorState message={error || 'Không tải được chuyến xe.'} onRetry={load} /></div>
  }

  const trip = detail.trip
  const departure = trip.departureLocation || trip.route?.departureLocation
  const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
  const routeName = trip.route?.routeName || `${departure?.name || 'Điểm đi'} → ${arrival?.name || 'Điểm đến'}`

  return (
    <div className="page-surface">
      <section className="page-banner page-banner--compact">
        <div className="container">
          <Link className="back-link" to="/tim-chuyen">← Quay lại danh sách chuyến</Link>
          <h1>{routeName}</h1>
          <p>{formatDateTime(trip.departureTime)}</p>
        </div>
      </section>

      <div className="container page-content">
        <BookingFlowSteps activeStep={1} />

        <section className="trip-detail-card">
          <div className="detail-route">
            <div>
              <span>Điểm đi</span>
              <strong>{departure?.name || 'Chưa cập nhật'}</strong>
              <small>{departure?.address || ''}</small>
            </div>
            <div className="detail-route__line">
              <b>{trip.route?.distanceKm ? `${trip.route.distanceKm} km` : 'Hành trình'}</b>
              <span />
            </div>
            <div>
              <span>Điểm đến</span>
              <strong>{arrival?.name || 'Chưa cập nhật'}</strong>
              <small>{arrival?.address || ''}</small>
            </div>
          </div>

          <div className="detail-meta">
            <div><span>Khởi hành</span><strong>{formatDateTime(trip.departureTime)}</strong></div>
            <div><span>Đến dự kiến</span><strong>{formatDateTime(trip.expectedArrivalTime)}</strong></div>
            <div>
              <span>Phương tiện</span>
              <strong>{getBusTypeLabel(trip.bus.busType)}</strong>
              <small>Biển số {formatLicensePlate(trip.bus.licensePlate)}</small>
            </div>
            <div>
              <span>{roomBus ? 'Giá phòng' : 'Giá vé'}</span>
              {roomBus ? (
                <><strong className="price-text">Đơn: {formatCurrency(trip.singleRoomPrice)}</strong><small>Đôi: {formatCurrency(trip.doubleRoomPrice)}</small></>
              ) : <strong className="price-text">{formatCurrency(trip.ticketPrice)}</strong>}
            </div>
          </div>
        </section>

        {roomBus && (
          <section className="room-pricing-guide">
            <div><strong>Phòng đơn</strong><span>Tối đa 1 khách</span><b>{formatCurrency(trip.singleRoomPrice)}</b></div>
            <div><strong>Phòng đôi</strong><span>Tối đa 2 khách</span><b>{formatCurrency(trip.doubleRoomPrice)}</b></div>
          </section>
        )}

        <div className="row g-4 align-items-start" id="so-do-ghe">
          <div className="col-xl-8">
            <section className="content-card">
              <div className="content-card__heading">
                <div><span className="eyebrow">SƠ ĐỒ {roomBus ? 'PHÒNG' : 'GHẾ'}</span><h2>{roomBus ? 'Chọn phòng và loại phòng' : 'Chọn vị trí của bạn'}</h2></div>
                <span className="availability-pill">Còn {seatData.summary.available}/{seatData.summary.total} vị trí</span>
              </div>
              <SeatMap
                busType={trip.bus.busType}
                floors={seatData.floors}
                selectedIds={new Set(selected.keys())}
                selectedSeats={selected}
                onToggle={toggleSeat}
              />
            </section>
          </div>

          <div className="col-xl-4">
            <aside className="booking-summary">
              <span className="eyebrow">LỰA CHỌN CỦA BẠN</span>
              <h2>Tạm tính chuyến đi</h2>
              <div className="summary-row">
                <span>Vị trí đã chọn</span>
                <strong>{selected.size ? [...selected.values()].map((seat) => `${seat.seatCode} (${getSeatTypeLabel(seat.seatType)})`).join(', ') : 'Chưa chọn'}</strong>
              </div>
              <div className="summary-row"><span>Số lượng</span><strong>{selected.size}/{MAX_SELECTED} vị trí</strong></div>
              <div className="summary-total"><span>Tổng tạm tính</span><strong>{formatCurrency(total)}</strong></div>
              <button className="btn btn-warning btn-lg w-100" disabled={!selected.size || continuing} onClick={continueBooking} type="button">
                {continuing ? 'Đang chuyển bước...' : 'Tiếp tục chọn điểm đón/trả'}
              </button>
              {notice && <div className={`alert alert-${notice.type} mt-3 mb-0`} role="alert">{notice.message}</div>}
              <p className="summary-note">
                Bước này chỉ ghi nhớ lựa chọn, <strong>chưa giữ chỗ</strong>. Hệ thống chỉ bắt đầu giữ ghế/phòng 10 phút khi bạn sang Bước 4 – Thanh toán.
              </p>
            </aside>
          </div>
        </div>
      </div>

      <RoomTypeDialog
        seat={roomChoiceSeat}
        singleRoomPrice={trip.singleRoomPrice}
        doubleRoomPrice={trip.doubleRoomPrice}
        onChoose={chooseRoomType}
        onClose={() => setRoomChoiceSeat(null)}
      />
    </div>
  )
}

export default TripDetailPage
