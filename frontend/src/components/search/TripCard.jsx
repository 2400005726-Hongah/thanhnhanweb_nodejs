import { Link } from 'react-router-dom'

import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime, formatTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'
import {
  getBusTypeLabel,
  isRoomBusType,
} from '../../utils/busTypes.js'

function TripCard({ trip }) {
  const route = trip.route || {}
  const departure = route.departureLocation || {}
  const arrival = route.arrivalLocation || {}
  const provinceLine = departure.province && arrival.province
    ? `${departure.province} → ${arrival.province}`
    : ''

  return (
    <article className="trip-card">
      <div className="trip-card__route">
        <span className="trip-badge">{getBusTypeLabel(trip.bus.busType)}</span>
        <h2>{route.routeName || 'Chưa xác định hành trình'}</h2>
        <p>{formatDateTime(trip.departureTime)}</p>
        {provinceLine && <small>{provinceLine}</small>}
      </div>
      <div className="trip-card__timeline">
        <div><strong>{formatTime(trip.departureTime)}</strong><span>{departure.name || 'Chưa cập nhật'}</span></div>
        <div className="timeline-line">{route.distanceKm != null ? <span>{route.distanceKm} km</span> : <span>→</span>}</div>
        <div><strong>{formatTime(trip.expectedArrivalTime)}</strong><span>{arrival.name || 'Chưa cập nhật'}</span></div>
      </div>
      <div className="trip-card__bus">
        <span>Xe</span><strong>{getBusTypeLabel(trip.bus.busType)}</strong><small>Biển số {formatLicensePlate(trip.bus.licensePlate)}</small>
      </div>
      <div className="trip-card__price">
        <span>
          Còn {trip.availableSeatCount}/{trip.capacity} vị trí
        </span>
        {isRoomBusType(trip.bus.busType) ? (
          <div className="trip-card__room-prices">
            <strong>
              Phòng đơn: {formatCurrency(trip.singleRoomPrice)}
            </strong>
            <strong>
              Phòng đôi: {formatCurrency(trip.doubleRoomPrice)}
            </strong>
          </div>
        ) : (
          <strong>{formatCurrency(trip.ticketPrice)}</strong>
        )}
        <div className="d-flex gap-2 justify-content-end flex-wrap">
          <Link className="btn btn-outline-primary" to={`/chuyen-xe/${trip.id}`}>Chi tiết</Link>
          <Link className="btn btn-primary" to={`/chuyen-xe/${trip.id}#so-do-ghe`}>Chọn ghế</Link>
        </div>
      </div>
    </article>
  )
}

export default TripCard
