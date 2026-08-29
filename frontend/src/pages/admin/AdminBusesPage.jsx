import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { getBuses, getTrips, updateBus } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'
import { getBusTypeLabel, getSeatTypeLabel } from '../../utils/busTypes.js'
import './AdminBusesPage.css'

const PAGE_SIZE = 30
const EMPTY_FILTERS = { keyword: '', status: '', busType: '' }
const STATUS_LABELS = { ACTIVE: 'Hoạt động', MAINTENANCE: 'Bảo trì', INACTIVE: 'Ngừng hoạt động' }
const TRIP_STATUS_LABELS = { OPEN: 'Đang mở bán', CLOSED: 'Ngừng bán', DEPARTED: 'Đã khởi hành', COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy' }

const statusClass = (status) => status === 'ACTIVE'
  ? 'status-badge status-badge--active'
  : status === 'MAINTENANCE'
    ? 'status-badge status-badge--pending'
    : 'status-badge status-badge--inactive'

const tripStatusClass = (status) => {
  if (status === 'OPEN') return 'admin-bus-trip-status is-open'
  if (status === 'DEPARTED') return 'admin-bus-trip-status is-departed'
  if (status === 'COMPLETED') return 'admin-bus-trip-status is-completed'
  if (status === 'CANCELLED') return 'admin-bus-trip-status is-cancelled'
  return 'admin-bus-trip-status is-closed'
}
const tripBusId = (trip) => trip?.bus?.id || trip?.busId || ''
const tripDeparture = (trip) => trip?.departureLocation || trip?.route?.departureLocation || null
const tripArrival = (trip) => trip?.arrivalLocation || trip?.route?.arrivalLocation || null
const tripJourneyName = (location, fallback) => location?.name || fallback || 'Chưa xác định'
const isFutureTrip = (trip, now = Date.now()) => Boolean(trip?.departureTime) && !['COMPLETED', 'CANCELLED'].includes(trip.status) && new Date(trip.departureTime).getTime() > now

function AdminBusesPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, PERMISSIONS.MANAGE_BUSES)
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })
  const [loading, setLoading] = useState(true)
  const [processingBusId, setProcessingBusId] = useState('')
  const [allTrips, setAllTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [tripsError, setTripsError] = useState('')
  const [expandedBusId, setExpandedBusId] = useState('')
  const [error, setError] = useState('')

  const loadTrips = useCallback(async () => {
    setTripsLoading(true)
    setTripsError('')
    try {
      const first = await getTrips({ page: 1, limit: 100, sort: 'desc' })
      const firstTrips = first?.trips ?? []
      const totalPages = Number(first?.pagination?.totalPages || 1)
      if (totalPages <= 1) setAllTrips(firstTrips)
      else {
        const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => getTrips({ page: index + 2, limit: 100, sort: 'desc' })))
        setAllTrips([...firstTrips, ...remainingPages.flatMap((result) => result?.trips ?? [])])
      }
    } catch (requestError) {
      setTripsError(getApiErrorMessage(requestError))
      setAllTrips([])
    } finally { setTripsLoading(false) }
  }, [])

  const load = useCallback(async (targetPage, targetFilters) => {
    setLoading(true)
    setError('')
    try {
      const result = await getBuses({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(targetFilters.keyword && { keyword: targetFilters.keyword }),
        ...(targetFilters.status && { status: targetFilters.status }),
        ...(targetFilters.busType && { busType: targetFilters.busType }),
      })
      setData(result)
    } catch (requestError) { setError(getApiErrorMessage(requestError)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page, appliedFilters) }, [appliedFilters, load, page])
  useEffect(() => { loadTrips() }, [loadTrips])

  const changeStatus = async (bus, nextStatus) => {
    if (!window.confirm(`Chuyển xe ${getBusTypeLabel(bus.busType)} - ${formatLicensePlate(bus.licensePlate)} sang trạng thái “${STATUS_LABELS[nextStatus]}”?`)) return
    setProcessingBusId(bus.id)
    try { await updateBus(bus.id, { status: nextStatus }); await load(page, appliedFilters) }
    catch (requestError) { window.alert(getApiErrorMessage(requestError)) }
    finally { setProcessingBusId('') }
  }

  const submitFilters = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({ keyword: filters.keyword.trim(), status: filters.status, busType: filters.busType })
  }
  const clearFilters = () => { setFilters({ ...EMPTY_FILTERS }); setAppliedFilters({ ...EMPTY_FILTERS }); setPage(1) }

  const tripsByBusId = useMemo(() => {
    const map = new Map()
    for (const trip of allTrips) {
      const busId = tripBusId(trip)
      if (!busId) continue
      if (!map.has(busId)) map.set(busId, [])
      map.get(busId).push(trip)
    }
    for (const trips of map.values()) trips.sort((a, b) => new Date(b.departureTime || 0) - new Date(a.departureTime || 0))
    return map
  }, [allTrips])

  if (error && !data) return <ErrorState message={error} onRetry={() => load(page, appliedFilters)} />
  if (loading && !data) return <LoadingState />

  const buses = data?.buses ?? []
  const pagination = data?.pagination ?? { page, total: buses.length, totalPages: 1 }

  return (
    <>
      <AdminPageHeader
        title="Quản lý xe"
        description={canManage ? 'Danh sách xe. Thêm, sửa và ngừng hoạt động được mở ở trang riêng.' : 'Nhân viên chỉ được xem xe và sơ đồ ghế.'}
        actions={canManage && <Link className="btn btn-primary" to="/admin/xe/them">+ Thêm xe</Link>}
      />
      {error && <div className="alert alert-danger">{error}</div>}
      {tripsError && <div className="alert alert-warning">Không tải được thống kê chuyến theo xe: {tripsError}</div>}

      <form className="admin-filter-bar" onSubmit={submitFilters}>
        <input className="form-control" onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Tìm theo biển số xe..." value={filters.keyword} />
        <select className="form-select" onChange={(event) => setFilters((current) => ({ ...current, busType: event.target.value }))} value={filters.busType}>
          <option value="">Tất cả loại xe</option><option value="SLEEPER_34">Giường nằm 34 giường</option><option value="LIMOUSINE_22">Limousine 22 phòng</option>
        </select>
        <select className="form-select" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
          <option value="">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="MAINTENANCE">Bảo trì</option><option value="INACTIVE">Ngừng hoạt động</option>
        </select>
        <div className="d-flex gap-2"><button className="btn btn-primary" type="submit">Tìm kiếm</button><button className="btn btn-outline-secondary" onClick={clearFilters} type="button">Xóa lọc</button></div>
      </form>

      {buses.length === 0 ? <EmptyState message="Không tìm thấy xe phù hợp." /> : (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>DANH SÁCH XE</span><h2>Xe đang quản lý</h2></div><small>{buses.length}/{pagination.total ?? buses.length} xe</small></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>STT</th><th>Biển số</th><th>Loại xe</th><th>Số ghế/phòng</th><th>Chuyến xe</th><th>Sơ đồ ghế</th><th>Trạng thái</th>{canManage && <th>Thao tác</th>}</tr></thead>
            <tbody>{buses.map((bus, index) => {
              const processing = processingBusId === bus.id
              const busTrips = tripsByBusId.get(bus.id) || []
              const futureCount = busTrips.filter((trip) => isFutureTrip(trip)).length
              const expanded = expandedBusId === bus.id
              return <Fragment key={bus.id}>
                <tr className={expanded ? 'admin-bus-row is-expanded' : 'admin-bus-row'}>
                  <td>{(page - 1) * PAGE_SIZE + index + 1}</td><td><strong>{formatLicensePlate(bus.licensePlate)}</strong></td><td>{getBusTypeLabel(bus.busType)}</td><td>{bus.capacity}</td>
                  <td><button className="admin-bus-trip-count-button" disabled={tripsLoading} onClick={() => setExpandedBusId((current) => current === bus.id ? '' : bus.id)} type="button"><strong>{tripsLoading ? '...' : `${busTrips.length} chuyến`}</strong><small>{tripsLoading ? 'Đang tải dữ liệu' : futureCount > 0 ? `Đang có ${futureCount} chuyến tương lai` : busTrips.length > 0 ? 'Chỉ còn lịch sử' : 'Chưa có chuyến'}</small></button></td>
                  <td>{bus.seats?.length ? <details className="admin-seat-layout"><summary>Xem {bus.seats.length} vị trí</summary>{[1, 2].map((floor) => { const seats = bus.seats.filter((seat) => seat.floor === floor); return seats.length ? <div key={floor}><strong>Tầng {floor}</strong><div>{seats.map((seat) => <span key={seat.id} title={getSeatTypeLabel(seat.seatType)}>{seat.seatCode}<small>{getSeatTypeLabel(seat.seatType)}</small></span>)}</div></div> : null })}</details> : 'Chưa có ghế'}</td>
                  <td><span className={statusClass(bus.status)}>{STATUS_LABELS[bus.status] || 'Không xác định'}</span></td>
                  {canManage && <td><div className="admin-row-actions"><Link to={`/admin/xe/${bus.id}/sua`}>Sửa</Link>{bus.status === 'ACTIVE' && <button disabled={processing} onClick={() => changeStatus(bus, 'MAINTENANCE')} type="button">Bảo trì</button>}{bus.status === 'MAINTENANCE' && <button disabled={processing} onClick={() => changeStatus(bus, 'ACTIVE')} type="button">Hoạt động lại</button>}{bus.status !== 'INACTIVE' ? <Link className="is-danger" to={`/admin/xe/${bus.id}/xoa`}>Ngừng hoạt động</Link> : <button disabled={processing} onClick={() => changeStatus(bus, 'ACTIVE')} type="button">Khôi phục</button>}</div></td>}
                </tr>
                {expanded && <tr className="admin-bus-trips-expanded-row"><td colSpan={canManage ? 8 : 7}><div className="admin-bus-trips-panel"><div className="admin-bus-trips-panel__heading"><div><strong>Chuyến của xe {formatLicensePlate(bus.licensePlate)}</strong><small>{getBusTypeLabel(bus.busType)} · {busTrips.length} chuyến</small></div><button className="btn btn-outline-secondary btn-sm" onClick={() => setExpandedBusId('')} type="button">Đóng</button></div>{busTrips.length === 0 ? <div className="admin-bus-trips-empty">Xe này chưa được gán cho chuyến nào.</div> : <div className="admin-bus-trip-list">{busTrips.map((trip) => { const departure = tripDeparture(trip); const arrival = tripArrival(trip); return <div className="admin-bus-trip-card" key={trip.id}><div className="admin-bus-trip-card__code"><strong>#{String(trip.id || '').slice(0, 8).toUpperCase()}</strong><span className={tripStatusClass(trip.status)}>{TRIP_STATUS_LABELS[trip.status] || trip.status || 'Không xác định'}</span></div><div className="admin-bus-trip-card__journey"><div className="is-departure"><span>●</span><strong>{tripJourneyName(departure, trip.route?.departureLocation?.name)}</strong></div><div className="is-arrival"><span>●</span><strong>{tripJourneyName(arrival, trip.route?.arrivalLocation?.name)}</strong></div></div><div className="admin-bus-trip-card__time"><span>Khởi hành</span><strong>{trip.departureTime ? formatDateTime(trip.departureTime) : '—'}</strong>{trip.expectedArrivalTime && <small>Đến dự kiến: {formatDateTime(trip.expectedArrivalTime)}</small>}</div><div className="admin-bus-trip-card__actions"><Link to={`/admin/chuyen-xe/${trip.id}/so-do-ghe`}>▣ Xem ghế</Link><Link to={`/admin/chuyen-xe/${trip.id}/hanh-khach`}>♣ Hành khách</Link></div></div> })}</div>}</div></td></tr>}
              </Fragment>
            })}</tbody></table></div>
          {pagination.totalPages > 1 && <div className="d-flex justify-content-between align-items-center mt-3"><button className="btn btn-outline-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Trang trước</button><strong>Trang {pagination.page ?? page}/{pagination.totalPages}</strong><button className="btn btn-outline-secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Trang sau</button></div>}
        </section>
      )}
    </>
  )
}
export default AdminBusesPage
