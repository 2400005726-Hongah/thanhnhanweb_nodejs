import {
  getSeatTypeLabel,
  isRoomBusType,
} from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'

const statusLabel = { AVAILABLE: 'Còn trống', HELD: 'Đang giữ', BOOKED: 'Đã đặt' }

function SeatMap({ busType, floors, selectedIds, selectedSeats = new Map(), onToggle }) {
  const roomBus = isRoomBusType(busType)

  return (
    <div className={`seat-map seat-map--${roomBus ? 'rooms-22' : 'sleeper-34'}`}>
      <div className="seat-legend" aria-label="Chú thích trạng thái ghế">
        <span><i className="seat-swatch seat-swatch--available" />Còn trống</span>
        <span><i className="seat-swatch seat-swatch--selected" />Đang chọn</span>
        <span><i className="seat-swatch seat-swatch--held" />Đang giữ</span>
        <span><i className="seat-swatch seat-swatch--booked" />Đã đặt</span>
      </div>
      {roomBus && (
        <p className="room-map-note">
          Mỗi phòng có thể chọn <strong>Phòng đơn</strong> hoặc <strong>Phòng đôi</strong>.
          Loại phòng và giá được chọn sau khi bấm vào phòng.
        </p>
      )}
      <div className="row g-4">
        {floors.map((floor) => (
          <div className="col-lg-6" key={floor.floor}>
            <section className="floor-card" aria-labelledby={`floor-${floor.floor}`}>
              <div className="floor-card__header">
                <h3 id={`floor-${floor.floor}`}>{floor.floor === 1 ? 'Tầng dưới' : 'Tầng trên'}</h3>
                <span>Đầu xe</span>
              </div>
              <div className="seat-grid">
                {floor.seats.map((seat) => {
                  const selected = selectedIds.has(seat.id)
                  const selectedSeat = selectedSeats.get?.(seat.id)
                  const effectiveSeatType = selectedSeat?.seatType || seat.seatType
                  const effectivePrice = selectedSeat?.price ?? seat.price
                  const seatAria = roomBus
                    ? `Phòng ${seat.seatCode}, ${statusLabel[seat.status]}${selectedSeat ? `, ${getSeatTypeLabel(effectiveSeatType)}, ${formatCurrency(effectivePrice)}` : ''}`
                    : `${getSeatTypeLabel(effectiveSeatType)} ${seat.seatCode}, ${statusLabel[seat.status]}, ${formatCurrency(effectivePrice)}`

                  return (
                    <button
                      type="button"
                      key={seat.id}
                      className={`seat seat--${seat.status.toLowerCase()}${selected ? ' seat--selected' : ''}`}
                      disabled={seat.status !== 'AVAILABLE'}
                      aria-pressed={selected}
                      aria-label={seatAria}
                      onClick={() => onToggle(seat)}
                    >
                      <span>{seat.seatCode}</span>
                      {roomBus ? (
                        <>
                          <small>{selectedSeat ? getSeatTypeLabel(effectiveSeatType) : 'Chọn loại phòng'}</small>
                          <em>{selectedSeat ? formatCurrency(effectivePrice) : 'Đơn / Đôi'}</em>
                        </>
                      ) : (
                        <>
                          <small>{getSeatTypeLabel(effectiveSeatType)}</small>
                          <em>{formatCurrency(effectivePrice)}</em>
                        </>
                      )}
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
