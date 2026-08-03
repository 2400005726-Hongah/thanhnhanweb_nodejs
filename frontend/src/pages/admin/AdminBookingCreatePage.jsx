import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import SeatMap from '../../components/seats/SeatMap.jsx'
import { createManagedBooking } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getTripDetail, getTripSeats } from '../../services/publicTrip.service.js'
import { saveBookingResult } from '../../utils/bookingSession.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { getPaymentOptionsForSource } from '../../utils/paymentLabels.js'

const sourceContent = {
  HOTLINE: {
    title: 'Đặt vé Hotline',
    description: 'Tạo vé do khách liên hệ tổng đài. Nguồn vé được cố định là HOTLINE.',
  },
  COUNTER: {
    title: 'Đặt vé tại quầy',
    description: 'Tạo vé trực tiếp tại quầy. Nguồn vé được cố định là COUNTER.',
  },
}

function AdminBookingCreatePage({ source }) {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [seatData, setSeatData] = useState(null)
  const [selected, setSelected] = useState(new Map())
  const [passenger, setPassenger] = useState({ fullName: '', phone: '', email: '' })
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
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return
    setError('')
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(seat.id)) {
        next.delete(seat.id)
      } else if (next.size < 6) {
        next.set(seat.id, seat)
      } else {
        setError('Mỗi booking chỉ được chọn tối đa 6 vị trí.')
      }
      return next
    })
  }

  const total = useMemo(
    () => [...selected.values()].reduce((sum, seat) => sum + seat.price, 0),
    [selected],
  )

  const submit = async (event) => {
    event.preventDefault()
    if (!selected.size || submitting) return

    setSubmitting(true)
    setError('')
    try {
      const data = await createManagedBooking({
        tripId,
        tripSeatIds: [...selected.keys()],
        source,
        passenger: {
          fullName: passenger.fullName.trim(),
          phone: passenger.phone.trim(),
          email: passenger.email.trim() || undefined,
        },
        customerNote: customerNote.trim() || undefined,
        staffNote: staffNote.trim() || undefined,
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
  if (!detail || !seatData) return <ErrorState message={error} onRetry={load} />

  const trip = detail.trip
  const content = sourceContent[source]

  return (
    <>
      <AdminPageHeader title={content.title} description={content.description} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>CHUYẾN ĐÃ CHỌN</span><h2>{trip.route.routeName}</h2></div>
          <strong>{source}</strong>
        </div>
        <div className="detail-meta">
          <div><span>Khởi hành</span><strong>{formatDateTime(trip.departureTime)}</strong></div>
          <div><span>Xe</span><strong>{trip.bus.busName}</strong><small>{trip.bus.licensePlate}</small></div>
          <div><span>Vị trí còn trống</span><strong>{seatData.summary.available}/{seatData.summary.total}</strong></div>
          <div><span>Tạm tính</span><strong>{formatCurrency(total)}</strong></div>
        </div>
      </section>

      <div className="row g-4 align-items-start">
        <div className="col-xl-8">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div><span>SƠ ĐỒ XE</span><h2>Chọn vị trí còn trống</h2></div>
              <small>{selected.size}/6 vị trí đã chọn</small>
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
          <form className="admin-panel" onSubmit={submit}>
            <div className="admin-panel-heading">
              <div><span>THÔNG TIN KHÁCH</span><h2>Tạo booking</h2></div>
            </div>
            <label className="admin-field mb-3"><span>Họ và tên</span><input className="form-control" required minLength="2" maxLength="100" value={passenger.fullName} onChange={(event) => setPassenger((current) => ({ ...current, fullName: event.target.value }))} /></label>
            <label className="admin-field mb-3"><span>Số điện thoại</span><input className="form-control" required type="tel" maxLength="20" value={passenger.phone} onChange={(event) => setPassenger((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label className="admin-field mb-3"><span>Email (không bắt buộc)</span><input className="form-control" type="email" maxLength="255" value={passenger.email} onChange={(event) => setPassenger((current) => ({ ...current, email: event.target.value }))} /></label>
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
            <div className="summary-row"><span>Ghế/phòng</span><strong>{[...selected.values()].map((seat) => seat.seatCode).join(', ') || 'Chưa chọn'}</strong></div>
            <div className="summary-total"><span>Tổng tiền máy chủ</span><strong>{formatCurrency(total)}</strong></div>
            <button className="btn btn-primary w-100 mt-3" disabled={!selected.size || submitting} type="submit">
              {submitting ? 'Đang tạo booking...' : `Xác nhận ${content.title}`}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default AdminBookingCreatePage
