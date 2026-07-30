import { useCallback, useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  cancelBooking,
  getBookings,
  markNoShow,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [filters, setFilters] = useState({ keyword: '', status: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (nextFilters = {}) => {
    setLoading(true)
    setError('')
    try {
      const data = await getBookings({
        page: 1,
        limit: 100,
        ...(nextFilters.keyword && { keyword: nextFilters.keyword }),
        ...(nextFilters.status && { status: nextFilters.status }),
      })
      setBookings(data.bookings)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ status: filters.status })
  }, [filters.status, load])

  const submit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const cancel = async (booking) => {
    if (!window.confirm(`Hủy vé ${booking.bookingCode}?`)) return
    try {
      await cancelBooking(booking.bookingCode)
      await load(filters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const noShow = async (booking) => {
    const reason = window.prompt('Nhập lý do khách Không đi (bắt buộc):')
    if (!reason?.trim()) return
    try {
      await markNoShow(booking.bookingCode, reason)
      await load(filters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Vé xe"
        description="Tìm kiếm, kiểm tra và xử lý vé theo nghiệp vụ hiện tại."
      />
      <form className="admin-filter-bar" onSubmit={submit}>
        <input
          className="form-control"
          onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
          placeholder="Mã vé, hành khách hoặc số điện thoại"
          value={filters.keyword}
        />
        <select
          className="form-select"
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          value={filters.status}
        >
          <option value="">Tất cả trạng thái</option>
          {['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW'].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">Tìm vé</button>
      </form>
      {error ? (
        <ErrorState message={error} onRetry={() => load(filters)} />
      ) : loading ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <EmptyState message="Không tìm thấy vé phù hợp." />
      ) : (
        <section className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Mã vé</th><th>Hành khách</th><th>Hành trình</th><th>Ghế</th><th>Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td><strong>{booking.bookingCode}</strong><small>{formatDateTime(booking.createdAt)}</small></td>
                    <td>{booking.passengerFullName}<small>{booking.passengerPhone}</small></td>
                    <td>{booking.trip.route.routeName}<small>{formatDateTime(booking.trip.departureTime)}</small></td>
                    <td>{booking.items.map((item) => item.seatCode).join(', ')}</td>
                    <td>{formatCurrency(booking.totalAmount)}</td>
                    <td><span className={`status-badge status-badge--${booking.status.toLowerCase()}`}>{booking.status}</span><small>{booking.paymentStatus}</small></td>
                    <td>
                      <div className="admin-row-actions">
                        {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                          <button className="is-danger" onClick={() => cancel(booking)} type="button">Hủy vé</button>
                        )}
                        {booking.status === 'CONFIRMED' && (
                          <button onClick={() => noShow(booking)} type="button">Không đi</button>
                        )}
                        <button onClick={() => window.print()} type="button">In vé</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default AdminBookingsPage
