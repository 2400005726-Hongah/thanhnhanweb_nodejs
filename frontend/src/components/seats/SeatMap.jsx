import {
  getSeatTypeLabel,
  isRoomBusType,
} from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'

import './SeatMapCompact.css'

const statusLabel = {
  AVAILABLE: 'Còn trống',
  HELD: 'Đang giữ',
  BOOKED: 'Đã đặt',
}

function SeatMap({ busType, floors, selectedIds, selectedSeats = new Map(), onToggle }) {
  const roomBus = isRoomBusType(busType)

  return (
    <div className={`seat-map-compact seat-map-compact--${roomBus ? 'rooms-22' : 'sleeper-34'}`}>
      <div className="seat-map-compact__legend" aria-label="Chú thích trạng thái ghế">
        <span><i />Còn trống</span>
        <span><i className="is-selected" />Đang chọn</span>
        <span><i className="is-unavailable" />Đã đặt</span>
      </div>

      {roomBus && (
        <p className="seat-map-compact__room-note">
          Chọn phòng, sau đó chọn <strong>Phòng đơn</strong> hoặc <strong>Phòng đôi</strong>.
        </p>
      )}

      <div className="seat-map-compact__floors">
        {floors.map((floor) => (
          <section className="seat-map-compact__floor" key={floor.floor}>
            <h3>{floor.floor === 1 ? 'TẦNG DƯỚI' : 'TẦNG TRÊN'}</h3>

            <div className="seat-map-compact__grid">
              {floor.seats.map((seat) => {
                const selected = selectedIds.has(seat.id)
                const selectedSeat = selectedSeats.get?.(seat.id)
                const effectiveSeatType = selectedSeat?.seatType || seat.seatType
                const effectivePrice = selectedSeat?.price ?? seat.price
                const unavailable = seat.status !== 'AVAILABLE'
                const seatAria = roomBus
                  ? `Phòng ${seat.seatCode}, ${statusLabel[seat.status] || 'Không xác định'}${selectedSeat ? `, ${getSeatTypeLabel(effectiveSeatType)}, ${formatCurrency(effectivePrice)}` : ''}`
                  : `${getSeatTypeLabel(effectiveSeatType)} ${seat.seatCode}, ${statusLabel[seat.status] || 'Không xác định'}, ${formatCurrency(effectivePrice)}`

                return (
                  <button
                    aria-label={seatAria}
                    aria-pressed={selected}
                    className={[
                      'seat-map-compact__seat',
                      selected ? 'is-selected' : '',
                      seat.status === 'HELD' ? 'is-held is-unavailable' : '',
                      seat.status === 'BOOKED' ? 'is-booked is-unavailable' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={unavailable}
                    key={seat.id}
                    onClick={() => onToggle(seat)}
                    title={selectedSeat ? `${seat.seatCode} - ${getSeatTypeLabel(effectiveSeatType)} - ${formatCurrency(effectivePrice)}` : seat.seatCode}
                    type="button"
                  >
                    <span>{seat.seatCode}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default SeatMap
