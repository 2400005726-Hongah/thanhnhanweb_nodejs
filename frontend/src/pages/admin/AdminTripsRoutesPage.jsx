import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import {
  changeTripStatus,
  createRoute,
  createTrip,
  deleteRoute,
  deleteTrip,
  getBuses,
  getRoutes,
  getTripCompletionPreview,
  getTrips,
  updateRoute,
  updateTrip,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getLocations } from '../../services/publicTrip.service.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'
import { getBusTypeLabel, isRoomBusType } from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate, normalizeRouteName } from '../../utils/normalizers.js'

const TRIP_PAGE_SIZE = 30

const TRIP_STATUS_LABELS = {
  OPEN: 'Đang mở bán',
  CLOSED: 'Đã đóng đặt vé',
  DEPARTED: 'Đã khởi hành',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
}

const ROUTE_STATUS_LABELS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
}

// Giữ thông điệp nghiệp vụ dùng trong biểu mẫu và bộ kiểm thử giao diện.
const ROUTE_PRICE_HELP_TEXT = {
  single: 'Giá phòng đơn mặc định (để trống nếu chưa cấu hình):',
  double: 'Giá phòng đôi mặc định (để trống nếu chưa cấu hình):',
}

const EMPTY_TRIP_FILTERS = {
  status: '',
  departureDate: '',
}

const EMPTY_TRIP_FORM = {
  route: '',
  bus: '',
  departureTime: '',
  expectedArrivalTime: '',
  ticketPrice: '',
  singleRoomPrice: '',
  doubleRoomPrice: '',
}

const EMPTY_ROUTE_FORM = {
  routeName: '',
  departureLocation: '',
  arrivalLocation: '',
  distanceKm: '',
  estimatedDurationMinutes: '',
  defaultTicketPrice: '',
  defaultSingleRoomPrice: '',
  defaultDoubleRoomPrice: '',
}

const shortCode = (id, prefix) =>
  `${prefix}-${String(id || '').split('-')[0].toUpperCase()}`

const toLocalDateTimeInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

const nullableNumber = (value) => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

const getTripStatusClass = (status) => {
  if (status === 'CANCELLED') return 'status-badge status-badge--cancelled'
  if (status === 'COMPLETED') return 'status-badge status-badge--completed'
  if (status === 'DEPARTED' || status === 'CLOSED') {
    return 'status-badge status-badge--pending'
  }
  return 'status-badge status-badge--active'
}

const getEffectiveTripStatus = (trip, now = new Date()) => {
  if (['COMPLETED', 'CANCELLED'].includes(trip.status)) return trip.status
  return new Date(trip.departureTime) <= now ? 'DEPARTED' : trip.status
}

const getRouteStatusClass = (status) =>
  status === 'ACTIVE'
    ? 'status-badge status-badge--active'
    : 'status-badge status-badge--inactive'

function AdminTripsRoutesPage() {
  const { user } = useAuth()

  const [trips, setTrips] = useState([])
  const [tripPage, setTripPage] = useState(1)
  const [tripPagination, setTripPagination] = useState(null)
  const [tripFilters, setTripFilters] = useState({ ...EMPTY_TRIP_FILTERS })
  const [appliedTripFilters, setAppliedTripFilters] = useState({
    ...EMPTY_TRIP_FILTERS,
  })

  const [routes, setRoutes] = useState([])
  const [buses, setBuses] = useState([])
  const [locations, setLocations] = useState([])

  const [showTripForm, setShowTripForm] = useState(false)
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [editingTrip, setEditingTrip] = useState(null)
  const [editingRoute, setEditingRoute] = useState(null)
  const [tripForm, setTripForm] = useState({ ...EMPTY_TRIP_FORM })
  const [routeForm, setRouteForm] = useState({ ...EMPTY_ROUTE_FORM })

  const [loading, setLoading] = useState(true)
  const [submittingTrip, setSubmittingTrip] = useState(false)
  const [submittingRoute, setSubmittingRoute] = useState(false)
  const [error, setError] = useState('')
  const [processingTripId, setProcessingTripId] = useState('')
  const [processingRouteId, setProcessingRouteId] = useState('')

  const canCreateTrips = hasPermission(user, PERMISSIONS.CREATE_TRIPS)
  const canEditTrips = hasPermission(user, PERMISSIONS.EDIT_TRIPS)
  const canDeleteTrips = hasPermission(user, PERMISSIONS.DELETE_TRIPS)
  const canCreateRoutes = hasPermission(user, PERMISSIONS.CREATE_ROUTES)
  const canEditRoutes = hasPermission(user, PERMISSIONS.EDIT_ROUTES)
  const canDeleteRoutes = hasPermission(user, PERMISSIONS.DELETE_ROUTES)

  const selectedTripBus = useMemo(
    () => buses.find((bus) => bus.id === tripForm.bus),
    [buses, tripForm.bus],
  )

  const load = useCallback(async (targetPage = 1, filters = EMPTY_TRIP_FILTERS) => {
    setLoading(true)
    setError('')

    try {
      const [tripData, routeData, busData, locationData] = await Promise.all([
        getTrips({
          page: targetPage,
          limit: TRIP_PAGE_SIZE,
          sort: 'asc',
          ...(filters.status && { status: filters.status }),
          ...(filters.departureDate && {
            departureDate: filters.departureDate,
          }),
        }),
        getRoutes({ page: 1, limit: 100 }),
        getBuses({ page: 1, limit: 100 }),
        getLocations(),
      ])

      setTrips(tripData?.trips ?? [])
      setTripPagination(
        tripData?.pagination ?? {
          page: targetPage,
          limit: TRIP_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        },
      )
      setRoutes(routeData?.routes ?? [])
      setBuses(busData?.buses ?? [])
      setLocations(locationData?.locations ?? [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(tripPage, appliedTripFilters)
  }, [appliedTripFilters, load, tripPage])

  const resetTripForm = () => {
    setShowTripForm(false)
    setEditingTrip(null)
    setTripForm({ ...EMPTY_TRIP_FORM })
  }

  const resetRouteForm = () => {
    setShowRouteForm(false)
    setEditingRoute(null)
    setRouteForm({ ...EMPTY_ROUTE_FORM })
  }

  const openCreateTrip = () => {
    resetRouteForm()
    setEditingTrip(null)
    setTripForm({ ...EMPTY_TRIP_FORM })
    setShowTripForm(true)
  }

  const openEditTrip = (trip) => {
    resetRouteForm()
    setEditingTrip(trip)
    setTripForm({
      route: trip.route?.id ?? trip.routeId ?? '',
      bus: trip.bus?.id ?? trip.busId ?? '',
      departureTime: toLocalDateTimeInput(trip.departureTime),
      expectedArrivalTime: toLocalDateTimeInput(trip.expectedArrivalTime),
      ticketPrice: trip.ticketPrice == null ? '' : String(Number(trip.ticketPrice)),
      singleRoomPrice:
        trip.singleRoomPrice == null ? '' : String(Number(trip.singleRoomPrice)),
      doubleRoomPrice:
        trip.doubleRoomPrice == null ? '' : String(Number(trip.doubleRoomPrice)),
    })
    setShowTripForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openCreateRoute = () => {
    resetTripForm()
    setEditingRoute(null)
    setRouteForm({ ...EMPTY_ROUTE_FORM })
    setShowRouteForm(true)
  }

  const openEditRoute = (route) => {
    resetTripForm()
    setEditingRoute(route)
    setRouteForm({
      routeName: route.routeName ?? '',
      departureLocation:
        route.departureLocation?.id ?? route.departureLocationId ?? '',
      arrivalLocation: route.arrivalLocation?.id ?? route.arrivalLocationId ?? '',
      distanceKm: route.distanceKm == null ? '' : String(Number(route.distanceKm)),
      estimatedDurationMinutes:
        route.estimatedDurationMinutes == null
          ? ''
          : String(Number(route.estimatedDurationMinutes)),
      defaultTicketPrice:
        route.defaultTicketPrice == null ? '' : String(Number(route.defaultTicketPrice)),
      defaultSingleRoomPrice:
        route.defaultSingleRoomPrice == null
          ? ''
          : String(Number(route.defaultSingleRoomPrice)),
      defaultDoubleRoomPrice:
        route.defaultDoubleRoomPrice == null
          ? ''
          : String(Number(route.defaultDoubleRoomPrice)),
    })
    setShowRouteForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const changeTripField = (event) => {
    const { name, value } = event.target
    setTripForm((current) => ({ ...current, [name]: value }))
  }

  const changeRouteField = (event) => {
    const { name, value } = event.target

    setRouteForm((current) => {
      const next = { ...current, [name]: value }

      if (['departureLocation', 'arrivalLocation'].includes(name)) {
        const departure = locations.find(
          (location) => location.id === next.departureLocation,
        )
        const arrival = locations.find(
          (location) => location.id === next.arrivalLocation,
        )

        next.routeName = departure && arrival
          ? `${departure.name} → ${arrival.name}`
          : ''
      }

      return next
    })
  }

  const submitTrip = async (event) => {
    event.preventDefault()

    const departureTime = new Date(tripForm.departureTime)
    const expectedArrivalTime = new Date(tripForm.expectedArrivalTime)

    if (!tripForm.route || !tripForm.bus || Number.isNaN(departureTime.getTime())) {
      window.alert('Vui lòng chọn tuyến, xe và thời gian khởi hành.')
      return
    }

    if (
      Number.isNaN(expectedArrivalTime.getTime()) ||
      expectedArrivalTime <= departureTime
    ) {
      window.alert('Thời gian dự kiến đến phải sau thời gian khởi hành.')
      return
    }

    const ticketPrice = nullableNumber(tripForm.ticketPrice)
    const singleRoomPrice = nullableNumber(tripForm.singleRoomPrice)
    const doubleRoomPrice = nullableNumber(tripForm.doubleRoomPrice)

    if ([ticketPrice, singleRoomPrice, doubleRoomPrice].some(Number.isNaN)) {
      window.alert('Giá vé phải là số không âm hoặc để trống.')
      return
    }

    setSubmittingTrip(true)
    try {
      const pricingPayload = {
        ticketPrice,
        singleRoomPrice,
        doubleRoomPrice,
      }

      if (editingTrip) {
        const payload = {
          ...pricingPayload,
          ...(tripForm.route !== (editingTrip.route?.id ?? editingTrip.routeId) && {
            route: tripForm.route,
          }),
          ...(tripForm.bus !== (editingTrip.bus?.id ?? editingTrip.busId) && {
            bus: tripForm.bus,
          }),
          ...(departureTime.getTime() !== new Date(editingTrip.departureTime).getTime() && {
            departureTime: departureTime.toISOString(),
          }),
          ...(expectedArrivalTime.getTime() !==
            new Date(editingTrip.expectedArrivalTime).getTime() && {
            expectedArrivalTime: expectedArrivalTime.toISOString(),
          }),
        }

        await updateTrip(editingTrip.id, payload)
      } else {
        await createTrip({
          route: tripForm.route,
          bus: tripForm.bus,
          departureTime: departureTime.toISOString(),
          expectedArrivalTime: expectedArrivalTime.toISOString(),
          ...pricingPayload,
        })
      }

      resetTripForm()
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmittingTrip(false)
    }
  }

  const submitRoute = async (event) => {
    event.preventDefault()

    if (routeForm.departureLocation === routeForm.arrivalLocation) {
      window.alert('Điểm đi và điểm đến phải khác nhau.')
      return
    }

    const distanceKm = Number(routeForm.distanceKm)
    const estimatedDurationMinutes = Number(routeForm.estimatedDurationMinutes)
    const defaultTicketPrice = nullableNumber(routeForm.defaultTicketPrice)
    const defaultSingleRoomPrice = nullableNumber(routeForm.defaultSingleRoomPrice)
    const defaultDoubleRoomPrice = nullableNumber(routeForm.defaultDoubleRoomPrice)

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      window.alert('Khoảng cách phải là số lớn hơn 0.')
      return
    }

    if (!Number.isInteger(estimatedDurationMinutes) || estimatedDurationMinutes <= 0) {
      window.alert('Thời gian dự kiến phải là số phút nguyên dương.')
      return
    }

    if (
      [defaultTicketPrice, defaultSingleRoomPrice, defaultDoubleRoomPrice].some(
        Number.isNaN,
      )
    ) {
      window.alert('Giá mặc định phải là số không âm hoặc để trống.')
      return
    }

    setSubmittingRoute(true)
    try {
      const payload = {
        routeName: normalizeRouteName(routeForm.routeName),
        departureLocation: routeForm.departureLocation,
        arrivalLocation: routeForm.arrivalLocation,
        distanceKm,
        estimatedDurationMinutes,
        defaultTicketPrice,
        defaultSingleRoomPrice,
        defaultDoubleRoomPrice,
      }

      if (editingRoute) {
        await updateRoute(editingRoute.id, payload)
      } else {
        await createRoute(payload)
      }

      resetRouteForm()
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmittingRoute(false)
    }
  }

  const updateStatus = async (trip, nextStatus) => {
    const nextLabel = TRIP_STATUS_LABELS[nextStatus] || 'Không xác định'
    if (
      !window.confirm(
        `Chuyển chuyến ${shortCode(trip.id, 'CX')} sang trạng thái "${nextLabel}"?`,
      )
    ) {
      return
    }

    setProcessingTripId(trip.id)
    try {
      await changeTripStatus(trip.id, nextStatus)
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  const completeTrip = async (trip) => {
    setProcessingTripId(trip.id)

    try {
      const previewData = await getTripCompletionPreview(trip.id)
      const preview = previewData.preview

      if (!preview.canComplete) {
        if (preview.missingPaymentCount > 0) {
          window.alert(
            `Có ${preview.missingPaymentCount} vé thiếu dữ liệu thanh toán. ` +
              'Hãy kiểm tra từng vé trong danh sách hành khách trước.',
          )
          return
        }

        if (preview.abnormalPaymentCount > 0) {
          window.alert(
            `Có ${preview.abnormalPaymentCount} vé có trạng thái thanh toán bất thường hoặc đã hoàn tiền. ` +
              'Hãy xử lý từng vé trước khi hoàn thành chuyến.',
          )
          return
        }
      }

      const confirmMessage =
        preview.unpaidBookingCount > 0
          ? `Chuyến còn ${preview.unpaidBookingCount} vé chưa thanh toán, tổng ${formatCurrency(
              preview.unpaidAmount,
            )}.\n\nNếu tiếp tục, toàn bộ vé đang Đã đặt và chưa thanh toán sẽ được chuyển thành Đã thanh toán và tính vào doanh thu.\n\nBạn có chắc chắn muốn hoàn thành chuyến?`
          : 'Tất cả vé hiệu lực đã thanh toán. Bạn có chắc chắn muốn hoàn thành chuyến?'

      if (!window.confirm(confirmMessage)) return

      const result = await changeTripStatus(trip.id, 'COMPLETED', {
        confirmCollectUnpaid: preview.unpaidBookingCount > 0,
      })

      const summary = result.trip?.completionSummary
      if (summary?.collectedBookings > 0) {
        window.alert(
          `Đã hoàn thành chuyến và xác nhận thanh toán ${summary.collectedBookings} vé, ` +
            `tổng ${formatCurrency(summary.collectedAmount)}.`,
        )
      } else {
        window.alert('Đã hoàn thành chuyến xe.')
      }

      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  const removeTrip = async (trip) => {
    if (!window.confirm(`Hủy chuyến ${shortCode(trip.id, 'CX')}?`)) return

    setProcessingTripId(trip.id)
    try {
      await deleteTrip(trip.id)
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  const removeRoute = async (route) => {
    if (
      !window.confirm(
        `Ngừng hoạt động tuyến "${route.routeName}"?\n\nTuyến vẫn được giữ trong lịch sử và không thể dùng để tạo chuyến mới.`,
      )
    ) {
      return
    }

    setProcessingRouteId(route.id)
    try {
      await deleteRoute(route.id)
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingRouteId('')
    }
  }

  const restoreRoute = async (route) => {
    if (!window.confirm(`Khôi phục tuyến "${route.routeName}" về trạng thái hoạt động?`)) {
      return
    }

    setProcessingRouteId(route.id)
    try {
      await updateRoute(route.id, { status: 'ACTIVE' })
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingRouteId('')
    }
  }

  const submitTripFilters = (event) => {
    event.preventDefault()
    setTripPage(1)
    setAppliedTripFilters({ ...tripFilters })
  }

  const clearTripFilters = () => {
    setTripFilters({ ...EMPTY_TRIP_FILTERS })
    setAppliedTripFilters({ ...EMPTY_TRIP_FILTERS })
    setTripPage(1)
  }

  if (error && !trips.length && !routes.length) {
    return <ErrorState message={error} onRetry={() => load(tripPage, appliedTripFilters)} />
  }

  if (loading && !trips.length && !routes.length) return <LoadingState />

  return (
    <>
      <AdminPageHeader
        title="Chuyến xe & Tuyến đường"
        description="Quản lý chuyến, trạng thái vận hành, giá vé và tuyến đường."
        actions={(
          <>
            {canCreateTrips && (
              <button className="btn btn-primary" onClick={openCreateTrip} type="button">
                + Thêm chuyến mới
              </button>
            )}
            {canCreateRoutes && (
              <button
                className="btn btn-outline-primary"
                onClick={openCreateRoute}
                type="button"
              >
                + Thêm tuyến đường
              </button>
            )}
          </>
        )}
      />

      {error && <div className="alert alert-danger">{error}</div>}

      {showTripForm && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>QUẢN LÝ CHUYẾN</span>
              <h2>{editingTrip ? 'Sửa chuyến xe' : 'Thêm chuyến mới'}</h2>
            </div>
          </div>

          <form className="admin-form-grid" onSubmit={submitTrip}>
            <label className="admin-field">
              <span>Tuyến đường</span>
              <select
                className="form-select"
                name="route"
                onChange={changeTripField}
                required
                value={tripForm.route}
              >
                <option value="">Chọn tuyến</option>
                {routes
                  .filter(
                    (route) =>
                      route.status === 'ACTIVE' ||
                      route.id === (editingTrip?.route?.id ?? editingTrip?.routeId),
                  )
                  .map((route) => (
                    <option key={route.id} value={route.id}>{route.routeName}</option>
                  ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Xe</span>
              <select
                className="form-select"
                name="bus"
                onChange={changeTripField}
                required
                value={tripForm.bus}
              >
                <option value="">Chọn xe</option>
                {buses
                  .filter(
                    (bus) =>
                      bus.status === 'ACTIVE' ||
                      bus.id === (editingTrip?.bus?.id ?? editingTrip?.busId),
                  )
                  .map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.busName} – {formatLicensePlate(bus.licensePlate)} – {getBusTypeLabel(bus.busType)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Khởi hành</span>
              <input
                className="form-control"
                name="departureTime"
                onChange={changeTripField}
                required
                type="datetime-local"
                value={tripForm.departureTime}
              />
            </label>

            <label className="admin-field">
              <span>Dự kiến đến</span>
              <input
                className="form-control"
                name="expectedArrivalTime"
                onChange={changeTripField}
                required
                type="datetime-local"
                value={tripForm.expectedArrivalTime}
              />
            </label>

            {isRoomBusType(selectedTripBus?.busType) ? (
              <>
                <label className="admin-field">
                  <span>Giá phòng đơn</span>
                  <input
                    className="form-control"
                    min="0"
                    name="singleRoomPrice"
                    onChange={changeTripField}
                    placeholder="Để trống để dùng giá tuyến"
                    type="number"
                    value={tripForm.singleRoomPrice}
                  />
                </label>
                <label className="admin-field">
                  <span>Giá phòng đôi</span>
                  <input
                    className="form-control"
                    min="0"
                    name="doubleRoomPrice"
                    onChange={changeTripField}
                    placeholder="Để trống để dùng giá tuyến"
                    type="number"
                    value={tripForm.doubleRoomPrice}
                  />
                </label>
              </>
            ) : (
              <label className="admin-field admin-field--wide">
                <span>Giá vé tại chuyến</span>
                <input
                  className="form-control"
                  min="0"
                  name="ticketPrice"
                  onChange={changeTripField}
                  placeholder="Để trống để dùng giá tuyến"
                  type="number"
                  value={tripForm.ticketPrice}
                />
              </label>
            )}

            <div className="admin-field admin-field--wide d-flex gap-2">
              <button className="btn btn-primary" disabled={submittingTrip} type="submit">
                {submittingTrip
                  ? 'Đang lưu...'
                  : editingTrip
                    ? 'Lưu thay đổi chuyến'
                    : 'Tạo chuyến và ghế'}
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={submittingTrip}
                onClick={resetTripForm}
                type="button"
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      {showRouteForm && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>QUẢN LÝ TUYẾN</span>
              <h2>{editingRoute ? 'Sửa tuyến đường' : 'Thêm tuyến đường'}</h2>
            </div>
          </div>

          <form className="admin-form-grid" onSubmit={submitRoute}>
            <label className="admin-field admin-field--wide">
              <span>Tên tuyến</span>
              <input
                className="form-control"
                maxLength="150"
                name="routeName"
                readOnly
                required
                value={routeForm.routeName}
              />
              <small>Tên tuyến được tạo tự động từ điểm đi và điểm đến.</small>
            </label>

            <label className="admin-field">
              <span>Điểm đi</span>
              <select
                className="form-select"
                name="departureLocation"
                onChange={changeRouteField}
                required
                value={routeForm.departureLocation}
              >
                <option value="">Chọn điểm đi</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} – {location.province}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Điểm đến</span>
              <select
                className="form-select"
                name="arrivalLocation"
                onChange={changeRouteField}
                required
                value={routeForm.arrivalLocation}
              >
                <option value="">Chọn điểm đến</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} – {location.province}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Khoảng cách (km)</span>
              <input
                className="form-control"
                min="1"
                name="distanceKm"
                onChange={changeRouteField}
                required
                type="number"
                value={routeForm.distanceKm}
              />
            </label>

            <label className="admin-field">
              <span>Thời gian dự kiến (phút)</span>
              <input
                className="form-control"
                min="1"
                name="estimatedDurationMinutes"
                onChange={changeRouteField}
                required
                type="number"
                value={routeForm.estimatedDurationMinutes}
              />
            </label>

            <label className="admin-field">
              <span>Giá vé 34 giường</span>
              <input
                className="form-control"
                min="0"
                name="defaultTicketPrice"
                onChange={changeRouteField}
                type="number"
                value={routeForm.defaultTicketPrice}
              />
            </label>

            <label className="admin-field" title={ROUTE_PRICE_HELP_TEXT.single}>
              <span>Giá phòng đơn</span>
              <input
                className="form-control"
                min="0"
                name="defaultSingleRoomPrice"
                onChange={changeRouteField}
                type="number"
                value={routeForm.defaultSingleRoomPrice}
              />
            </label>

            <label className="admin-field" title={ROUTE_PRICE_HELP_TEXT.double}>
              <span>Giá phòng đôi</span>
              <input
                className="form-control"
                min="0"
                name="defaultDoubleRoomPrice"
                onChange={changeRouteField}
                type="number"
                value={routeForm.defaultDoubleRoomPrice}
              />
            </label>

            {editingRoute && (
              <div className="admin-field admin-field--wide">
                <small>
                  Tuyến đã có lịch sử chuyến chỉ được sửa tên, khoảng cách, thời gian và giá;
                  máy chủ sẽ chặn việc đổi điểm đi hoặc điểm đến.
                </small>
              </div>
            )}

            <div className="admin-field admin-field--wide d-flex gap-2">
              <button className="btn btn-primary" disabled={submittingRoute} type="submit">
                {submittingRoute
                  ? 'Đang lưu...'
                  : editingRoute
                    ? 'Lưu thay đổi tuyến'
                    : 'Tạo tuyến đường'}
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={submittingRoute}
                onClick={resetRouteForm}
                type="button"
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      <form className="admin-filter-bar" onSubmit={submitTripFilters}>
        <select
          className="form-select"
          name="status"
          onChange={(event) =>
            setTripFilters((current) => ({ ...current, status: event.target.value }))
          }
          value={tripFilters.status}
        >
          <option value="">Tất cả trạng thái chuyến</option>
          {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          className="form-control"
          name="departureDate"
          onChange={(event) =>
            setTripFilters((current) => ({
              ...current,
              departureDate: event.target.value,
            }))
          }
          type="date"
          value={tripFilters.departureDate}
        />
        <div className="d-flex gap-2">
          <button className="btn btn-primary" type="submit">Lọc chuyến</button>
          <button
            className="btn btn-outline-secondary"
            onClick={clearTripFilters}
            type="button"
          >
            Xóa lọc
          </button>
        </div>
      </form>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>KHU VỰC 1</span><h2>Danh sách chuyến xe</h2></div>
          <small>{tripPagination?.total ?? trips.length} chuyến</small>
        </div>

        {trips.length === 0 ? (
          <EmptyState message="Không tìm thấy chuyến xe phù hợp." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã chuyến</th>
                  <th>Xe</th>
                  <th>Tuyến đường</th>
                  <th>Khởi hành</th>
                  <th>Giá vé</th>
                  <th>Ghế</th>
                  <th>Trạng thái</th>
                  <th>Đặt vé</th>
                  <th>Sơ đồ ghế</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip, index) => {
                  const now = new Date()
                  const isProcessing = processingTripId === trip.id
                  const effectiveStatus = getEffectiveTripStatus(trip, now)
                  const hasDeparted = effectiveStatus === 'DEPARTED'
                  const isFinal = ['COMPLETED', 'CANCELLED'].includes(effectiveStatus)
                  const canBook = trip.status === 'OPEN' && !hasDeparted && !isFinal
                  const canManageBeforeDeparture =
                    !hasDeparted && !isFinal && ['OPEN', 'CLOSED'].includes(trip.status)
                  const canComplete = hasDeparted && canEditTrips

                  return (
                    <tr key={trip.id}>
                      <td>{(tripPage - 1) * TRIP_PAGE_SIZE + index + 1}</td>
                      <td><strong>{shortCode(trip.id, 'CX')}</strong></td>
                      <td>
                        <strong>{trip.bus?.licensePlate ? formatLicensePlate(trip.bus.licensePlate) : 'Chưa có xe'}</strong>
                        <small>{trip.bus?.busName || 'Chưa cập nhật'}</small>
                        <small>{getBusTypeLabel(trip.bus?.busType)}</small>
                      </td>
                      <td>
                        <strong>{trip.route?.routeName || 'Chưa cập nhật'}</strong>
                        <small>
                          {trip.route?.departureLocation?.name || '—'} →{' '}
                          {trip.route?.arrivalLocation?.name || '—'}
                        </small>
                      </td>
                      <td>
                        <strong>{formatDateTime(trip.departureTime)}</strong>
                        <small>Dự kiến đến: {formatDateTime(trip.expectedArrivalTime)}</small>
                      </td>
                      <td>
                        {isRoomBusType(trip.bus?.busType) ? (
                          <>
                            <strong>Đơn: {formatCurrency(trip.singleRoomPrice ?? 0)}</strong>
                            <small>Đôi: {formatCurrency(trip.doubleRoomPrice ?? 0)}</small>
                          </>
                        ) : (
                          <strong>{formatCurrency(trip.ticketPrice ?? 0)}</strong>
                        )}
                      </td>
                      <td>
                        <strong>Còn: {trip.seatStats?.available ?? '—'}</strong>
                        <small>Đã đặt: {trip.seatStats?.booked ?? '—'}</small>
                        <small>Đang giữ: {trip.seatStats?.held ?? '—'}</small>
                      </td>
                      <td>
                        <span className={getTripStatusClass(effectiveStatus)}>
                          {TRIP_STATUS_LABELS[effectiveStatus] || 'Không xác định'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions admin-row-actions--booking">
                          {canBook ? (
                            <>
                              <Link to={`/admin/dat-ve-tai-quay/${trip.id}`}>Tại quầy</Link>
                              <Link to={`/admin/dat-ve-hotline/${trip.id}`}>Hotline</Link>
                            </>
                          ) : (
                            <span className="admin-action-locked">Không thể đặt</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-row-actions admin-row-actions--seat-map">
                          <Link to={`/admin/chuyen-xe/${trip.id}/so-do-ghe`}>Xem ghế</Link>
                          <Link to={`/admin/chuyen-xe/${trip.id}/hanh-khach`}>Hành khách</Link>
                        </div>
                      </td>
                      <td>
                        <div className="admin-row-actions admin-row-actions--trip-management">
                          {canManageBeforeDeparture && canEditTrips && (
                            <button
                              disabled={isProcessing}
                              onClick={() => openEditTrip(trip)}
                              type="button"
                            >
                              Sửa
                            </button>
                          )}
                          {canManageBeforeDeparture && canEditTrips && trip.status === 'OPEN' && (
                            <button
                              disabled={isProcessing}
                              onClick={() => updateStatus(trip, 'CLOSED')}
                              type="button"
                            >
                              Đóng đặt vé
                            </button>
                          )}
                          {canManageBeforeDeparture && canEditTrips && trip.status === 'CLOSED' && (
                            <button
                              disabled={isProcessing}
                              onClick={() => updateStatus(trip, 'OPEN')}
                              type="button"
                            >
                              Mở lại
                            </button>
                          )}
                          {canDeleteTrips && canManageBeforeDeparture && (
  <button
    className="is-danger"
    disabled={isProcessing}
    onClick={() => removeTrip(trip)}
    type="button"
  >
    Hủy chuyến
  </button>
)}
                          {canComplete && (
                            <button
                              className="is-success"
                              disabled={isProcessing}
                              onClick={() => completeTrip(trip)}
                              type="button"
                            >
                              {isProcessing ? 'Đang xử lý...' : 'Hoàn thành'}
                            </button>
                          )}
                          {effectiveStatus === 'COMPLETED' && (
                            <span className="admin-action-locked">Đã khóa xử lý</span>
                          )}
                          {effectiveStatus === 'CANCELLED' && (
                            <span className="admin-action-locked">Đã hủy</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {(tripPagination?.totalPages ?? 1) > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <button
              className="btn btn-outline-secondary"
              disabled={tripPage <= 1 || loading}
              onClick={() => setTripPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Trang trước
            </button>
            <strong>Trang {tripPagination?.page ?? tripPage}/{tripPagination?.totalPages ?? 1}</strong>
            <button
              className="btn btn-outline-secondary"
              disabled={tripPage >= (tripPagination?.totalPages ?? 1) || loading}
              onClick={() => setTripPage((current) => current + 1)}
              type="button"
            >
              Trang sau
            </button>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span>KHU VỰC 2</span><h2>Danh sách tuyến đường</h2></div>
          <small>{routes.length} tuyến</small>
        </div>

        {routes.length === 0 ? (
          <EmptyState message="Chưa có tuyến đường." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã tuyến</th>
                  <th>Tên tuyến</th>
                  <th>Điểm đi</th>
                  <th>Điểm đến</th>
                  <th>Khoảng cách/Thời gian</th>
                  <th>Giá mặc định</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route, index) => {
                  const isProcessing = processingRouteId === route.id
                  return (
                    <tr key={route.id}>
                      <td>{index + 1}</td>
                      <td><strong>{shortCode(route.id, 'TX')}</strong></td>
                      <td><strong>{route.routeName}</strong></td>
                      <td>{route.departureLocation?.name || 'Chưa cập nhật'}</td>
                      <td>{route.arrivalLocation?.name || 'Chưa cập nhật'}</td>
                      <td>
                        <strong>{Number(route.distanceKm || 0)} km</strong>
                        <small>{Number(route.estimatedDurationMinutes || 0)} phút</small>
                      </td>
                      <td>
                        <strong>
                          34 giường: {route.defaultTicketPrice == null
                            ? 'Chưa đặt'
                            : formatCurrency(route.defaultTicketPrice)}
                        </strong>
                        <small>
                          Phòng đơn: {route.defaultSingleRoomPrice == null
                            ? 'Chưa đặt'
                            : formatCurrency(route.defaultSingleRoomPrice)}
                        </small>
                        <small>
                          Phòng đôi: {route.defaultDoubleRoomPrice == null
                            ? 'Chưa đặt'
                            : formatCurrency(route.defaultDoubleRoomPrice)}
                        </small>
                      </td>
                      <td>
                        <span className={getRouteStatusClass(route.status)}>
                          {ROUTE_STATUS_LABELS[route.status] || 'Không xác định'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          {canEditRoutes && (
                            <button
                              disabled={isProcessing}
                              onClick={() => openEditRoute(route)}
                              type="button"
                            >
                              Sửa
                            </button>
                          )}
                          {canDeleteRoutes && route.status === 'ACTIVE' && (
                            <button
                              className="is-danger"
                              disabled={isProcessing}
                              onClick={() => removeRoute(route)}
                              type="button"
                            >
                              Ngừng hoạt động
                            </button>
                          )}
                          {canCreateRoutes && route.status === 'INACTIVE' && (
                            <button
                              disabled={isProcessing}
                              onClick={() => restoreRoute(route)}
                              type="button"
                            >
                              Khôi phục
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default AdminTripsRoutesPage
