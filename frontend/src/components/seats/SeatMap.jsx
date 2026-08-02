import {
  getSeatTypeLabel,
  isRoomBusType,
} from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'

const statusLabel = { AVAILABLE: 'Còn trống', HELD: 'Đang giữ', BOOKED: 'Đã đặt' }

function SeatMap({ busType, floors, selectedIds, onToggle }) {
  const roomBus = isRoomBusType(busType)

  return (
    <div className={`seat-map seat-map--${roomBus ? 'rooms-22' : 'sleeper-34'}`}>
      <div className="seat-legend" aria-label="Chú thích trạng thái ghế">
        {roomBus && (
          <>
            <span><i className="seat-swatch seat-swatch--single" />Phòng đơn</span>
            <span><i className="seat-swatch seat-swatch--double" />Phòng đôi</span>
          </>
        )}
        <span><i className="seat-swatch seat-swatch--available" />Còn trống</span>
        <span><i className="seat-swatch seat-swatch--selected" />Đang chọn</span>
        <span><i className="seat-swatch seat-swatch--held" />Đang giữ</span>
        <span><i className="seat-swatch seat-swatch--booked" />Đã đặt</span>
      </div>
      <div className="row g-4">
        {floors.map((floor) => (
          <div className="col-lg-6" key={floor.floor}>
            <section className="floor-card" aria-labelledby={`floor-${floor.floor}`}>
              <div className="floor-card__header"><h3 id={`floor-${floor.floor}`}>Tầng {floor.floor}</h3><span>Đầu xe</span></div>
              <div className="seat-grid">
                {floor.seats.map((seat) => {
                  const selected = selectedIds.has(seat.id)
                  return (
                    <button
                      type="button"
                      key={seat.id}
                      className={`seat seat--${seat.status.toLowerCase()} seat--type-${seat.seatType.toLowerCase()}${selected ? ' seat--selected' : ''}`}
                      disabled={seat.status !== 'AVAILABLE'}
                      aria-pressed={selected}
                      aria-label={`${getSeatTypeLabel(seat.seatType)} ${seat.seatCode}, ${statusLabel[seat.status]}, ${formatCurrency(seat.price)}`}
                      onClick={() => onToggle(seat)}
                    >
                      <span>{seat.seatCode}</span>
                      <small>{getSeatTypeLabel(seat.seatType)}</small>
                      <em>{formatCurrency(seat.price)}</em>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SeatMap
