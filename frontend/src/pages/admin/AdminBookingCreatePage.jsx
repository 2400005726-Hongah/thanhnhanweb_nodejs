import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import RoomTypeDialog from '../../components/seats/RoomTypeDialog.jsx'
import SeatMap from '../../components/seats/SeatMap.jsx'
import { createManagedBooking } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getTripDetail, getTripSeats } from '../../services/publicTrip.service.js'
import { saveBookingResult } from '../../utils/bookingSession.js'
import { getSeatTypeLabel, isRoomBusType } from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { getPaymentOptionsForSource } from '../../utils/paymentLabels.js'
import {
  formatLicensePlate,
  formatPhoneInput,
  isValidFullName,
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizeMultilineText,
  normalizePhone,
  normalizeWhitespace,
} from '../../utils/normalizers.js'

const MAX_SELECTED = 6
const sourceLabels = { HOTLINE: 'Hotline', COUNTER: 'Tại quầy' }

const sourceContent = {
  HOTLINE: {
    title: 'Đặt vé Hotline',
    description: 'Tạo vé do khách liên hệ tổng đài. Nguồn vé được cố định là Hotline.',
  },
  COUNTER: {
    title: 'Đặt vé tại quầy',
    description: 'Tạo vé trực tiếp tại quầy. Nguồn vé được cố định là Tại quầy.',
  },
}

function AdminBookingCreatePage({ source }) {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [seatData, setSeatData] = useState(null)
  const [selected, setSelected] = useState(new Map())
  const [roomChoiceSeat, setRoomChoiceSeat] = useState(null)
  const [passenger, setPassenger] = useState({ fullName: '', phone: '', email: '' })
  const [pickupPoint, setPickupPoint] = useState('')
  const [dropoffPoint, setDropoffPoint] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(
    source === 'COUNTER' ? 'CASH_COUNTER' : 'BANK_TRANSFER',
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [tripDetail, seats] = await Promise.all([
        getTripDetail(tripId),
        getTripSeats(tripId),
      ])
      setDetail(tripDetail)
      setSeatData(seats)
      setSelected(new Map())
      setRoomChoiceSeat(null)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  const trip = detail?.trip
  const roomBus = trip ? isRoomBusType(trip.bus.busType) : false

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return
    setError('')

    if (selected.has(seat.id)) {
      setSelected((current) => {
        const next = new Map(current)
        next.delete(seat.id)
        return next
      })
      return
    }

    if (selected.size >= MAX_SELECTED) {
      setError(`Mỗi vé chỉ được chọn tối đa ${MAX_SELECTED} vị trí.`)
      return
    }

    if (roomBus) {
      setRoomChoiceSeat(seat)
      return
    }

    setSelected((current) => new Map(current).set(seat.id, seat))
  }

  const chooseRoomType = (roomType) => {
    if (!roomChoiceSeat || !trip) return
    const price = roomType === 'DOUBLE_ROOM'
      ? trip.doubleRoomPrice
      : trip.singleRoomPrice

    setSelected((current) => {
      const next = new Map(current)
      next.set(roomChoiceSeat.id, {
        ...roomChoiceSeat,
        seatType: roomType,
        price,
      })
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
      ? [...selected.values()].map((seat) => ({
          tripSeatId: seat.id,
          roomType: seat.seatType,
        }))
      : [],
    [roomBus, selected],
  )

  const submit = async (event) => {
    event.preventDefault()
    if (!selected.size || submitting) return

    const fullName = normalizeFullName(passenger.fullName)
    const phone = normalizePhone(passenger.phone)
    const email = normalizeEmail(passenger.email)

    if (!isValidFullName(fullName)) {
      setError('Họ tên hành khách không hợp lệ.')
      return
    }
    if (!isVietnamesePhone(phone)) {
      setError('Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const data = await createManagedBooking({
        tripId,
        tripSeatIds: [...selected.keys()],
        ...(roomSelections.length && { roomSelections }),
        source,
        passenger: {
          fullName,
          phone,
          email: email || undefined,
        },
        pickupPoint: normalizeWhitespace(pickupPoint) || undefined,
        dropoffPoint: normalizeWhitespace(dropoffPoint) || undefined,
        customerNote: customerNote.trim()
          ? normalizeMultilineText(customerNote.trim())
          : undefined,
        staffNote: staffNote.trim()
          ? normalizeMultilineText(staffNote.trim())
          : undefined,
        paymentMethod,
      })
      if (data.customerWarning) window.alert(data.customerWarning)
      saveBookingResult(data.booking)
      navigate(`/dat-ve-thanh-cong/${data.booking.bookingCode}`, {
        state: { booking: data.booking },
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
      if ([403, 409].includes(requestError.response?.status)) {
        try {
          const seats = await getTripSeats(tripId)
          setSeatData(seats)
          setSelected(new Map())
        } catch {
          // Giữ thông báo nghiệp vụ ban đầu nếu tải lại sơ đồ thất bại.
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState label="Đang tải chuyến và sơ đồ ghế..." />
  if (!detail || !seatData || !trip) return <ErrorState message={error} onRetry={load} />

  const content = sourceContent[source]

  return (
    <>
      <AdminPageHeader title={content.title} description={content.description} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>CHUYẾN ĐÃ CHỌN</span><h2>{trip.route.routeName}</h2></div>
          <strong>{sourceLabels[source] || 'Không xác định'}</strong>
        </div>
        <div className="detail-meta">
          <div><span>Khởi hành</span><strong>{formatDateTime(trip.departureTime)}</strong></div>
          <div><span>Xe</span><strong>{trip.bus.busName}</strong><small>{formatLicensePlate(trip.bus.licensePlate)}</small></div>
          <div><span>Vị trí còn trống</span><strong>{seatData.summary.available}/{seatData.summary.total}</strong></div>
          <div><span>Tạm tính</span><strong>{formatCurrency(total)}</strong></div>
        </div>
      </section>

      {roomBus && (
        <section className="admin-panel room-admin-pricing">
          <strong>Limousine 22 phòng:</strong>
          <span>Phòng đơn {formatCurrency(trip.singleRoomPrice)}</span>
          <span>Phòng đôi {formatCurrency(trip.doubleRoomPrice)}</span>
          <small>Bấm một phòng trống để chọn loại phòng cho vé này.</small>
        </section>
      )}

      <div className="row g-4 align-items-start">
        <div className="col-xl-8">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div><span>SƠ ĐỒ XE</span><h2>Chọn vị trí còn trống</h2></div>
              <small>{selected.size}/{MAX_SELECTED} vị trí đã chọn</small>
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
          <form className="admin-panel" onSubmit={submit}>
            <div className="admin-panel-heading">
              <div><span>THÔNG TIN KHÁCH</span><h2>Tạo vé</h2></div>
            </div>
            <label className="admin-field mb-3"><span>Họ và tên</span><input className="form-control" required minLength="2" maxLength="100" value={passenger.fullName} onChange={(event) => setPassenger((current) => ({ ...current, fullName: event.target.value }))} onBlur={(event) => setPassenger((current) => ({ ...current, fullName: normalizeFullName(event.target.value) }))} /></label>
            <label className="admin-field mb-3"><span>Số điện thoại</span><input className="form-control" required type="tel" maxLength="12" placeholder="0912 345 678" inputMode="tel" value={passenger.phone} onChange={(event) => setPassenger((current) => ({ ...current, phone: formatPhoneInput(event.target.value) }))} /></label>
            <label className="admin-field mb-3"><span>Email (không bắt buộc)</span><input className="form-control" type="email" maxLength="255" value={passenger.email} onChange={(event) => setPassenger((current) => ({ ...current, email: event.target.value }))} onBlur={(event) => setPassenger((current) => ({ ...current, email: normalizeEmail(event.target.value) }))} /></label>
            <label className="admin-field mb-3"><span>Điểm đón chi tiết</span><input className="form-control" maxLength="300" placeholder="Địa chỉ hoặc điểm hẹn đón khách" value={pickupPoint} onChange={(event) => setPickupPoint(event.target.value)} /></label>
            <label className="admin-field mb-3"><span>Điểm trả chi tiết</span><input className="form-control" maxLength="300" placeholder="Địa chỉ hoặc điểm trả khách" value={dropoffPoint} onChange={(event) => setDropoffPoint(event.target.value)} /></label>
            <label className="admin-field mb-3"><span>Ghi chú khách hàng</span><textarea className="form-control" rows="2" maxLength="500" value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} /></label>
            <label className="admin-field mb-3"><span>Ghi chú nhân viên</span><textarea className="form-control" rows="3" maxLength="1000" value={staffNote} onChange={(event) => setStaffNote(event.target.value)} /></label>
            <label className="admin-field mb-3">
              <span>Phương thức thanh toán</span>
              <select className="form-select" required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {getPaymentOptionsForSource(source).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {paymentMethod === 'PAY_AT_BUS' && <small>Khách thanh toán trực tiếp khi lên xe.</small>}
            </label>
            <div className="summary-row">
              <span>Ghế/phòng</span>
              <strong>
                {[...selected.values()].map((seat) =>
                  roomBus
                    ? `${seat.seatCode} (${getSeatTypeLabel(seat.seatType)})`
                    : seat.seatCode,
                ).join(', ') || 'Chưa chọn'}
              </strong>
            </div>
            <div className="summary-total"><span>Tổng tiền máy chủ</span><strong>{formatCurrency(total)}</strong></div>
            <button className="btn btn-primary w-100 mt-3" disabled={!selected.size || submitting} type="submit">
              {submitting ? 'Đang tạo vé...' : `Xác nhận ${content.title}`}
            </button>
          </form>
        </div>
      </div>

      <RoomTypeDialog
        seat={roomChoiceSeat}
        singleRoomPrice={trip.singleRoomPrice}
        doubleRoomPrice={trip.doubleRoomPrice}
        onChoose={chooseRoomType}
        onClose={() => setRoomChoiceSeat(null)}
      />
    </>
  )
}

export default AdminBookingCreatePage
