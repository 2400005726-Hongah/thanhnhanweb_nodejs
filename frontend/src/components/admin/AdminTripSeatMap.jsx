import { isRoomBusType } from '../../utils/busTypes.js'

const STATUS_LABELS = {
  AVAILABLE: 'Còn trống',
  HELD: 'Đang giữ',
  BOOKED: 'Đã đặt',
}

function AdminTripSeatMap({ busType, floors }) {
  const roomBus = isRoomBusType(busType)

  return (
    <div className={`seat-map seat-map--${roomBus ? 'rooms-22' : 'sleeper-34'}`}>
      <div className="seat-legend" aria-label="Chú thích trạng thái ghế">
        <span><i className="seat-swatch seat-swatch--available" />Còn trống</span>
        <span><i className="seat-swatch seat-swatch--held" />Đang giữ</span>
        <span><i className="seat-swatch seat-swatch--booked" />Đã đặt</span>
      </div>

      <div className="row g-4">
        {floors.map((floor) => (
          <div className="col-lg-6" key={floor.floor}>
            <section className="floor-card" aria-labelledby={`admin-floor-${floor.floor}`}>
              <div className="floor-card__header">
                <h3 id={`admin-floor-${floor.floor}`}>
                  {floor.floor === 1 ? 'Tầng dưới' : 'Tầng trên'}
                </h3>
                <span>Đầu xe</span>
              </div>

              <div className="seat-grid">
                {floor.seats.map((seat) => (
                  <button
                    aria-label={`${roomBus ? 'Phòng' : 'Ghế'} ${seat.seatCode}, ${STATUS_LABELS[seat.status] || 'Không xác định'}`}
                    className={`seat seat--${String(seat.status || 'AVAILABLE').toLowerCase()}`}
                    disabled
                    key={seat.id}
                    type="button"
                  >
                    <span>{seat.seatCode}</span>
                    <small>{STATUS_LABELS[seat.status] || 'Không xác định'}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminTripSeatMap
