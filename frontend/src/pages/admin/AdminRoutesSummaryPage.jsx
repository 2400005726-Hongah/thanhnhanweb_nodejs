import { useCallback, useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getRouteSummary, getTrips } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

import './AdminTripsRoutesPage.css'

const TRIP_FETCH_LIMIT = 100

const provinceName = (location) =>
  location?.provinceRef?.name || location?.province || 'Chưa xác định'

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const getLocationId = (location) => location?.id || location?.locationId || null

const isSameLocation = (left, right) => {
  const leftId = getLocationId(left)
  const rightId = getLocationId(right)

  if (leftId && rightId) return leftId === rightId

  return (
    normalizeText(left?.name) === normalizeText(right?.name) &&
    normalizeText(provinceName(left)) === normalizeText(provinceName(right))
  )
}

const getTripDeparture = (trip) =>
  trip?.departureLocation || trip?.route?.departureLocation || null

const getTripArrival = (trip) =>
  trip?.arrivalLocation || trip?.route?.arrivalLocation || null

const getTripDepartureTime = (trip) => {
  const candidates = [
    trip?.departureTime,
    trip?.departureDateTime,
    trip?.startTime,
  ]

  for (const value of candidates) {
    if (!value) continue
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }

  return null
}

const getTripPrices = (trip) =>
  [
    trip?.ticketPrice,
    trip?.singleRoomPrice,
    trip?.doubleRoomPrice,
    trip?.price,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)

const getPositiveRoutePrice = (route) => {
  const candidates = [
    route?.lowestPrice,
    route?.minPrice,
    route?.minimumPrice,
    route?.lowestTicketPrice,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)

  return candidates.length ? Math.min(...candidates) : null
}

const getRouteDepartureFallback = (route) =>
  route?.nextDepartureTime ||
  route?.nearestDepartureTime ||
  route?.upcomingDepartureTime ||
  null

const loadAllTrips = async () => {
  const firstPage = await getTrips({ page: 1, limit: TRIP_FETCH_LIMIT, sort: 'asc' })
  const trips = [...(firstPage?.trips ?? [])]
  const totalPages = Math.max(Number(firstPage?.pagination?.totalPages) || 1, 1)

  for (let page = 2; page <= totalPages; page += 1) {
    const pageData = await getTrips({ page, limit: TRIP_FETCH_LIMIT, sort: 'asc' })
    trips.push(...(pageData?.trips ?? []))
  }

  return trips
}

function AdminRoutesSummaryPage({ embedded = false, refreshKey = 0 }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [routeData, allTrips] = await Promise.all([
        getRouteSummary(),
        loadAllTrips(),
      ])

      const now = new Date()

      const enrichedRoutes = (routeData?.routes ?? []).map((route) => {
        const matchingTrips = allTrips.filter((trip) => {
          if (trip?.status === 'CANCELLED') return false

          return (
            isSameLocation(getTripDeparture(trip), route?.departureLocation) &&
            isSameLocation(getTripArrival(trip), route?.arrivalLocation)
          )
        })

        const allPrices = matchingTrips.flatMap(getTripPrices)
        const computedLowestPrice = allPrices.length ? Math.min(...allPrices) : null

        const upcomingTrips = matchingTrips
          .map((trip) => ({ trip, departure: getTripDepartureTime(trip) }))
          .filter(({ trip, departure }) => {
            if (!departure) return false
            if (departure.getTime() < now.getTime()) return false
            return !['CANCELLED', 'COMPLETED'].includes(trip?.status)
          })
          .sort((left, right) => left.departure - right.departure)

        const computedNextDeparture = upcomingTrips[0]?.departure?.toISOString() || null

        const computedOpenCount = matchingTrips.filter((trip) => {
          if (trip?.status !== 'OPEN') return false
          const departure = getTripDepartureTime(trip)
          return departure ? departure.getTime() >= now.getTime() : true
        }).length

        return {
          ...route,
          tripCount: matchingTrips.length || Number(route?.tripCount) || 0,
          openCount:
            matchingTrips.length > 0
              ? computedOpenCount
              : Number(route?.openCount) || 0,
          lowestPrice: computedLowestPrice ?? getPositiveRoutePrice(route),
          nextDepartureTime: computedNextDeparture ?? getRouteDepartureFallback(route),
        }
      })

      setRoutes(enrichedRoutes)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (!embedded && loading && routes.length === 0) return <LoadingState />
  if (!embedded && error && routes.length === 0) {
    return <ErrorState message={error} onRetry={load} />
  }

  return (
    <>
      {!embedded && (
        <AdminPageHeader
          title="Chuyến xe & Tuyến đường"
          description="Tuyến đường được tổng hợp tự động từ danh sách chuyến xe."
        />
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="admin-panel admin-route-mvc-panel" id="tuyen-xe-dang-khai-thac">
        <div className="admin-route-mvc-heading">
          <div>
            <h2>Các tuyến xe đang khai thác</h2>
            <p>Dữ liệu được tổng hợp tự động từ danh sách chuyến xe. Mục này không thêm, sửa hoặc xóa tuyến thủ công.</p>
          </div>
          <small>{routes.length} tuyến</small>
        </div>

        {loading && routes.length === 0 ? (
          <LoadingState label="Đang tổng hợp tuyến xe từ danh sách chuyến..." />
        ) : routes.length === 0 ? (
          <EmptyState message="Chưa có tuyến nào vì chưa có chuyến xe." />
        ) : (
          <div className="admin-table-wrap admin-route-mvc-table-wrap">
            <table className="admin-table admin-route-mvc-table">
              <thead>
                <tr>
                  <th>Hành trình cụ thể</th>
                  <th>Tỉnh/Thành</th>
                  <th>Tổng chuyến</th>
                  <th>Đang mở bán</th>
                  <th>Giá thấp nhất</th>
                  <th>Chuyến gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr key={route.key}>
                    <td className="admin-route-mvc-journey">
                      <strong className="is-departure">{route.departureLocation?.name || '—'}</strong>
                      <span>↓</span>
                      <strong className="is-arrival">{route.arrivalLocation?.name || '—'}</strong>
                    </td>
                    <td>
                      <strong>{provinceName(route.departureLocation)} → {provinceName(route.arrivalLocation)}</strong>
                    </td>
                    <td className="admin-route-mvc-number"><strong>{route.tripCount ?? 0}</strong></td>
                    <td className="admin-route-mvc-number">
                      <span className="admin-route-open-count">{route.openCount ?? 0}</span>
                    </td>
                    <td className="admin-route-mvc-price">
                      {route.lowestPrice == null ? '—' : formatCurrency(route.lowestPrice)}
                    </td>
                    <td className="admin-route-mvc-nearest">
                      {route.nextDepartureTime
                        ? formatDateTime(route.nextDepartureTime)
                        : 'Chưa có chuyến sắp chạy'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default AdminRoutesSummaryPage
