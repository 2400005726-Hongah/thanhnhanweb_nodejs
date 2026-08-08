import formatCurrency from '../../utils/formatCurrency.js'

function RoomTypeDialog({ seat, singleRoomPrice, doubleRoomPrice, onChoose, onClose }) {
  if (!seat) return null

  return (
    <div className="room-choice-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="room-choice-title"
        aria-modal="true"
        className="room-choice-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <h2 id="room-choice-title">Mã phòng: {seat.seatCode}</h2>
          <button aria-label="Đóng" onClick={onClose} type="button">×</button>
        </header>

        <p>Chọn loại phòng:</p>
        <div className="room-choice-options">
          <button onClick={() => onChoose('SINGLE_ROOM')} type="button">
            <strong>Phòng đơn</strong>
            <span>Tối đa 1 khách</span>
            <b>{formatCurrency(singleRoomPrice)}</b>
          </button>
          <button onClick={() => onChoose('DOUBLE_ROOM')} type="button">
            <strong>Phòng đôi</strong>
            <span>Tối đa 2 khách</span>
            <b>{formatCurrency(doubleRoomPrice)}</b>
          </button>
        </div>

        <footer>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Đóng
          </button>
        </footer>
      </section>
    </div>
  )
}

export default RoomTypeDialog
