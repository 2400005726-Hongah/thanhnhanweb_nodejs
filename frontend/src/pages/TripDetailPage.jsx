import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import SeatMap from '../components/seats/SeatMap.jsx'
import { holdSeats } from '../services/booking.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripDetail, getTripSeats } from '../services/publicTrip.service.js'
import { saveSeatHold } from '../utils/bookingSession.js'
import {
  getBusTypeLabel,
  getSeatTypeLabel,
  isRoomBusType,
} from '../utils/busTypes.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatDateTime } from '../utils/formatDateTime.js'

function TripDetailPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [seatData, setSeatData] = useState(null)
  const [selected, setSelected] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [holding, setHolding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([getTripDetail(tripId), getTripSeats(tripId)])
      .then(([tripDetail, seats]) => {
        setDetail(tripDetail)
        setSeatData(seats)
        setSelected(new Map())
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false))
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return
    setNotice(null)
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(seat.id)) next.delete(seat.id)
      else next.set(seat.id, seat)
      return next
    })
  }

  const total = useMemo(
    () => [...selected.values()].reduce((sum, seat) => sum + seat.price, 0),
    [selected],
  )

  const continueBooking = async () => {
    if (!selected.size || holding) return

    setHolding(true)
    setNotice(null)
    try {
      const hold = await holdSeats(tripId, [...selected.keys()])
      saveSeatHold(tripId, hold)
      navigate(`/dat-ve/${tripId}`)
    } catch (requestError) {
      const message = getApiErrorMessage(requestError)
      setNotice({ type: 'danger', message })

      if (requestError.response?.status === 409) {
        try {
          const seats = await getTripSeats(tripId)
          setSeatData(seats)
          setSelected(new Map())
        } catch {
          // The original conflict message remains the most useful feedback.
        }
      }
    } finally {
      setHolding(false)
    }
  }

  if (loading) {
    return (
      <div className="container page-content">
        <LoadingState label="Đang tải thông tin chuyến và sơ đồ ghế..." />
      </div>
    )
  }
  if (error) {
    return (
      <div className="container page-content">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  const trip = detail.trip
  const roomBus = isRoomBusType(trip.bus.busType)

  return (
    <div className="page-surface">
      <section className="page-banner page-banner--compact">
        <div className="container">
          <Link className="back-link" to="/tim-chuyen">
            ← Quay lại danh sách chuyến
          </Link>
          <h1>{trip.route.routeName}</h1>
          <p>{formatDateTime(trip.departureTime)}</p>
        </div>
      </section>
      <div className="container page-content">
        <section className="trip-detail-card">
          <div className="detail-route">
            <div>
              <span>Điểm đi</span>
              <strong>{trip.route.departureLocation.name}</strong>
              <small>{trip.route.departureLocation.address}</small>
            </div>
            <div className="detail-route__line">
              <b>{trip.route.distanceKm} km</b>
              <span />
            </div>
            <div>
              <span>Điểm đến</span>
              <strong>{trip.route.arrivalLocation.name}</strong>
              <small>{trip.route.arrivalLocation.address}</small>
            </div>
          </div>
          <div className="detail-meta">
            <div>
              <span>Khởi hành</span>
              <strong>{formatDateTime(trip.departureTime)}</strong>
            </div>
            <div>
              <span>Đến dự kiến</span>
              <strong>{formatDateTime(trip.expectedArrivalTime)}</strong>
            </div>
            <div>
              <span>Phương tiện</span>
              <strong>{trip.bus.busName}</strong>
              <small>
                {getBusTypeLabel(trip.bus.busType)} · {trip.bus.licensePlate}
              </small>
            </div>
            <div>
              <span>{roomBus ? 'Giá phòng' : 'Giá vé'}</span>
              {roomBus ? (
                <>
                  <strong className="price-text">
                    Đơn: {formatCurrency(trip.singleRoomPrice)}
                  </strong>
                  <small>
                    Đôi: {formatCurrency(trip.doubleRoomPrice)}
                  </small>
                </>
              ) : (
                <strong className="price-text">
                  {formatCurrency(trip.ticketPrice)}
                </strong>
              )}
            </div>
          </div>
        </section>

        <div className="row g-4 align-items-start" id="so-do-ghe">
          <div className="col-xl-8">
            <section className="content-card">
              <div className="content-card__heading">
                <div>
                  <span className="eyebrow">SƠ ĐỒ GHẾ</span>
                  <h2>Chọn vị trí của bạn</h2>
                </div>
                <span className="availability-pill">
                  Còn {seatData.summary.available}/{seatData.summary.total} vị trí
                </span>
              </div>
              <SeatMap
                busType={trip.bus.busType}
                floors={seatData.floors}
                selectedIds={new Set(selected.keys())}
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
                <strong>
                  {selected.size
                    ? [...selected.values()]
                        .map(
                          (seat) =>
                            `${seat.seatCode} (${getSeatTypeLabel(seat.seatType)})`,
                        )
                        .join(', ')
                    : 'Chưa chọn'}
                </strong>
              </div>
              <div className="summary-row">
                <span>Số lượng</span>
                <strong>{selected.size} vị trí</strong>
              </div>
              <div className="summary-total">
                <span>Tổng tạm tính</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <button
                className="btn btn-warning btn-lg w-100"
                disabled={!selected.size || holding}
                onClick={continueBooking}
              >
                {holding ? 'Đang giữ ghế...' : 'Tiếp tục đặt vé'}
              </button>
              {notice && (
                <div className={`alert alert-${notice.type} mt-3 mb-0`} role="alert">
                  {notice.message}
                </div>
              )}
              <p className="summary-note">
                Hệ thống sẽ giữ ghế trong 10 phút sau khi bạn tiếp tục.
                Tổng tiền chính thức luôn được máy chủ tính lại.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TripDetailPage
