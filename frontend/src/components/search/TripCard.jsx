import { Link } from 'react-router-dom'

import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime, formatTime } from '../../utils/formatDateTime.js'
import {
  getBusTypeLabel,
  isRoomBusType,
} from '../../utils/busTypes.js'

function TripCard({ trip }) {
  return (
    <article className="trip-card">
      <div className="trip-card__route">
        <span className="trip-badge">{getBusTypeLabel(trip.bus.busType)}</span>
        <h2>{trip.route.routeName}</h2>
        <p>{formatDateTime(trip.departureTime)}</p>
      </div>
      <div className="trip-card__timeline">
        <div><strong>{formatTime(trip.departureTime)}</strong><span>{trip.route.departureLocation.name}</span></div>
        <div className="timeline-line"><span>{trip.route.distanceKm} km</span></div>
        <div><strong>{formatTime(trip.expectedArrivalTime)}</strong><span>{trip.route.arrivalLocation.name}</span></div>
      </div>
      <div className="trip-card__bus">
        <span>Xe</span><strong>{trip.bus.busName}</strong><small>Biển số {trip.bus.licensePlate}</small>
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
