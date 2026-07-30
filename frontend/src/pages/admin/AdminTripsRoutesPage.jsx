import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import {
  deleteRoute,
  deleteTrip,
  createRoute,
  createTrip,
  getBuses,
  getRoutes,
  getTrips,
  updateRoute,
  updateTrip,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getLocations } from '../../services/publicTrip.service.js'
import {
  hasPermission,
  PERMISSIONS,
} from '../../utils/adminPermissions.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

const shortCode = (id, prefix) =>
  `${prefix}-${String(id || '').split('-')[0].toUpperCase()}`

function AdminTripsRoutesPage() {
  const { user } = useAuth()
  const [trips, setTrips] = useState([])
  const [routes, setRoutes] = useState([])
  const [buses, setBuses] = useState([])
  const [locations, setLocations] = useState([])
  const [showTripForm, setShowTripForm] = useState(false)
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [tripForm, setTripForm] = useState({
    route: '',
    bus: '',
    departureTime: '',
    expectedArrivalTime: '',
    ticketPrice: '',
  })
  const [routeForm, setRouteForm] = useState({
    routeName: '',
    departureLocation: '',
    arrivalLocation: '',
    distanceKm: '',
    estimatedDurationMinutes: '',
    defaultTicketPrice: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canCreateTrips = hasPermission(user, PERMISSIONS.CREATE_TRIPS)
  const canDeleteTrips = hasPermission(user, PERMISSIONS.DELETE_TRIPS)
  const canCreateRoutes = hasPermission(user, PERMISSIONS.CREATE_ROUTES)
  const canDeleteRoutes = hasPermission(user, PERMISSIONS.DELETE_ROUTES)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [tripData, routeData, busData, locationData] = await Promise.all([
        getTrips({ page: 1, limit: 100, sort: 'asc' }),
        getRoutes({ page: 1, limit: 100 }),
        getBuses({ page: 1, limit: 100 }),
        getLocations(),
      ])
      setTrips(tripData.trips)
      setRoutes(routeData.routes)
      setBuses(busData.buses)
      setLocations(locationData.locations)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submitTrip = async (event) => {
    event.preventDefault()
    try {
      await createTrip({
        ...tripForm,
        departureTime: new Date(tripForm.departureTime).toISOString(),
        expectedArrivalTime: new Date(
          tripForm.expectedArrivalTime,
        ).toISOString(),
        ticketPrice: Number(tripForm.ticketPrice),
      })
      setShowTripForm(false)
      setTripForm({
        route: '',
        bus: '',
        departureTime: '',
        expectedArrivalTime: '',
        ticketPrice: '',
      })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const submitRoute = async (event) => {
    event.preventDefault()
    try {
      await createRoute({
        ...routeForm,
        distanceKm: Number(routeForm.distanceKm),
        estimatedDurationMinutes: Number(
          routeForm.estimatedDurationMinutes,
        ),
        defaultTicketPrice: routeForm.defaultTicketPrice
          ? Number(routeForm.defaultTicketPrice)
          : null,
      })
      setShowRouteForm(false)
      setRouteForm({
        routeName: '',
        departureLocation: '',
        arrivalLocation: '',
        distanceKm: '',
        estimatedDurationMinutes: '',
        defaultTicketPrice: '',
      })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const editTrip = async (trip) => {
    const value = window.prompt(
      'Nhập giá vé mới:',
      String(Number(trip.ticketPrice)),
    )
    if (value === null) return
    try {
      const data = await updateTrip(trip.id, { ticketPrice: Number(value) })
      setTrips((current) =>
        current.map((item) => (item.id === trip.id ? data.trip : item)),
      )
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const removeTrip = async (trip) => {
    if (!window.confirm(`Hủy chuyến ${shortCode(trip.id, 'CX')}?`)) return
    try {
      const data = await deleteTrip(trip.id)
      setTrips((current) =>
        current.map((item) => (item.id === trip.id ? data.trip : item)),
      )
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const editRoute = async (route) => {
    const routeName = window.prompt('Tên tuyến đường:', route.routeName)
    if (!routeName?.trim()) return
    try {
      const data = await updateRoute(route.id, { routeName })
      setRoutes((current) =>
        current.map((item) => (item.id === route.id ? data.route : item)),
      )
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const removeRoute = async (route) => {
    if (!window.confirm(`Xóa mềm tuyến ${route.routeName}?`)) return
    try {
      const data = await deleteRoute(route.id)
      setRoutes((current) =>
        current.map((item) => (item.id === route.id ? data.route : item)),
      )
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <>
      <AdminPageHeader
        title="Chuyến xe & Tuyến đường"
        description="Hai danh sách vận hành được quản lý trên cùng một màn hình."
        actions={
          <>
            {canCreateTrips && (
              <button className="btn btn-primary" onClick={() => setShowTripForm((value) => !value)} type="button">
                + Thêm chuyến mới
              </button>
            )}
            {canCreateRoutes && (
              <button className="btn btn-outline-primary" onClick={() => setShowRouteForm((value) => !value)} type="button">
                + Thêm tuyến đường
              </button>
            )}
          </>
        }
      />

      {showTripForm && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>CHỈ CHỦ XE</span><h2>Thêm chuyến mới</h2></div></div>
          <form className="admin-form-grid" onSubmit={submitTrip}>
            <label className="admin-field"><span>Tuyến đường</span><select className="form-select" onChange={(event) => setTripForm((current) => ({ ...current, route: event.target.value }))} required value={tripForm.route}><option value="">Chọn tuyến</option>{routes.filter((route) => route.status === 'ACTIVE').map((route) => <option key={route.id} value={route.id}>{route.routeName}</option>)}</select></label>
            <label className="admin-field"><span>Xe</span><select className="form-select" onChange={(event) => setTripForm((current) => ({ ...current, bus: event.target.value }))} required value={tripForm.bus}><option value="">Chọn xe</option>{buses.filter((bus) => bus.status === 'ACTIVE').map((bus) => <option key={bus.id} value={bus.id}>{bus.busName} – {bus.licensePlate}</option>)}</select></label>
            <label className="admin-field"><span>Khởi hành</span><input className="form-control" onChange={(event) => setTripForm((current) => ({ ...current, departureTime: event.target.value }))} required type="datetime-local" value={tripForm.departureTime} /></label>
            <label className="admin-field"><span>Dự kiến đến</span><input className="form-control" onChange={(event) => setTripForm((current) => ({ ...current, expectedArrivalTime: event.target.value }))} required type="datetime-local" value={tripForm.expectedArrivalTime} /></label>
            <label className="admin-field admin-field--wide"><span>Giá vé</span><input className="form-control" min="0" onChange={(event) => setTripForm((current) => ({ ...current, ticketPrice: event.target.value }))} required type="number" value={tripForm.ticketPrice} /></label>
            <div className="admin-field admin-field--wide"><button className="btn btn-primary" type="submit">Tạo chuyến và ghế</button></div>
          </form>
        </section>
      )}

      {showRouteForm && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>CHỈ CHỦ XE</span><h2>Thêm tuyến đường</h2></div></div>
          <form className="admin-form-grid" onSubmit={submitRoute}>
            <label className="admin-field admin-field--wide"><span>Tên tuyến</span><input className="form-control" onChange={(event) => setRouteForm((current) => ({ ...current, routeName: event.target.value }))} required value={routeForm.routeName} /></label>
            <label className="admin-field"><span>Điểm đi</span><select className="form-select" onChange={(event) => setRouteForm((current) => ({ ...current, departureLocation: event.target.value }))} required value={routeForm.departureLocation}><option value="">Chọn điểm đi</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} – {location.province}</option>)}</select></label>
            <label className="admin-field"><span>Điểm đến</span><select className="form-select" onChange={(event) => setRouteForm((current) => ({ ...current, arrivalLocation: event.target.value }))} required value={routeForm.arrivalLocation}><option value="">Chọn điểm đến</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} – {location.province}</option>)}</select></label>
            <label className="admin-field"><span>Khoảng cách (km)</span><input className="form-control" min="1" onChange={(event) => setRouteForm((current) => ({ ...current, distanceKm: event.target.value }))} required type="number" value={routeForm.distanceKm} /></label>
            <label className="admin-field"><span>Thời gian dự kiến (phút)</span><input className="form-control" min="1" onChange={(event) => setRouteForm((current) => ({ ...current, estimatedDurationMinutes: event.target.value }))} required type="number" value={routeForm.estimatedDurationMinutes} /></label>
            <label className="admin-field admin-field--wide"><span>Giá vé mặc định</span><input className="form-control" min="0" onChange={(event) => setRouteForm((current) => ({ ...current, defaultTicketPrice: event.target.value }))} type="number" value={routeForm.defaultTicketPrice} /></label>
            <div className="admin-field admin-field--wide"><button className="btn btn-primary" type="submit">Tạo tuyến đường</button></div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>KHU VỰC 1</span><h2>Danh sách chuyến xe</h2></div>
          <small>{trips.length} chuyến</small>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã chuyến</th><th>Xe</th><th>Tuyến đường</th>
                <th>Khởi hành</th><th>Giá vé</th><th>Ghế</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td><strong>{shortCode(trip.id, 'CX')}</strong></td>
                  <td>{trip.bus?.busName}<small>{trip.bus?.licensePlate} · {trip.bus?.busType}</small></td>
                  <td>{trip.route?.routeName}</td>
                  <td>{formatDateTime(trip.departureTime)}</td>
                  <td>{formatCurrency(trip.ticketPrice)}</td>
                  <td>
                    <span className="admin-seat-count">Trống {trip.seatStats?.available ?? '—'}</span>
                    <small>Đã đặt {trip.seatStats?.booked ?? '—'}</small>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <Link to={`/chuyen-xe/${trip.id}`}>Sơ đồ ghế</Link>
                      <Link to={`/dat-ve/${trip.id}`}>Tại quầy</Link>
                      <Link to={`/dat-ve/${trip.id}`}>Hotline</Link>
                      <button onClick={() => editTrip(trip)} type="button">Sửa</button>
                      {canDeleteTrips && (
                        <button className="is-danger" onClick={() => removeTrip(trip)} type="button">Xóa</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>KHU VỰC 2</span><h2>Danh sách tuyến đường</h2></div>
          <small>{routes.length} tuyến</small>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã tuyến</th><th>Điểm đi</th><th>Điểm đến</th>
                <th>Giá mặc định</th><th>Trạng thái</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id}>
                  <td><strong>{shortCode(route.id, 'TX')}</strong></td>
                  <td>{route.departureLocation?.name}</td>
                  <td>{route.arrivalLocation?.name}</td>
                  <td>{route.defaultTicketPrice == null ? 'Chưa đặt' : formatCurrency(route.defaultTicketPrice)}</td>
                  <td><span className={`status-badge status-badge--${route.status.toLowerCase()}`}>{route.status}</span></td>
                  <td>
                    <div className="admin-row-actions">
                      <button onClick={() => editRoute(route)} type="button">Sửa</button>
                      {canDeleteRoutes && (
                        <button className="is-danger" onClick={() => removeRoute(route)} type="button">Xóa</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default AdminTripsRoutesPage
