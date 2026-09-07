import { isRoomBusType } from '../../utils/busTypes.js'

import '../seats/SeatMapCompact.css'

const STATUS_LABELS = {
  AVAILABLE: 'Còn trống',
  HELD: 'Đang giữ',
  BOOKED: 'Đã đặt',
}

function AdminTripSeatMap({ busType, floors }) {
  const roomBus = isRoomBusType(busType)

  return (
    <div className={`seat-map-compact seat-map-compact--${roomBus ? 'rooms-22' : 'sleeper-34'}`}>
      <div className="seat-map-compact__legend" aria-label="Chú thích trạng thái ghế">
        <span><i />Còn trống</span>
        <span><i className="is-held" />Đang giữ</span>
        <span><i className="is-booked" />Đã đặt</span>
      </div>

      <div className="seat-map-compact__floors">
        {floors.map((floor) => (
          <section className="seat-map-compact__floor" key={floor.floor}>
            <h3>{floor.floor === 1 ? 'TẦNG DƯỚI' : 'TẦNG TRÊN'}</h3>

            <div className="seat-map-compact__grid">
              {floor.seats.map((seat) => (
                <button
                  aria-label={`${roomBus ? 'Phòng' : 'Ghế'} ${seat.seatCode}, ${STATUS_LABELS[seat.status] || 'Không xác định'}`}
                  className={[
                    'seat-map-compact__seat',
                    seat.status === 'HELD' ? 'is-held' : '',
                    seat.status === 'BOOKED' ? 'is-booked' : '',
                  ].filter(Boolean).join(' ')}
                  disabled
                  key={seat.id}
                  title={`${seat.seatCode} - ${STATUS_LABELS[seat.status] || 'Không xác định'}`}
                  type="button"
                >
                  <span>{seat.seatCode}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default AdminTripSeatMap
