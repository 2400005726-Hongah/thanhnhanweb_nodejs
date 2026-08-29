import { useCallback, useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getRouteSummary, getTrips } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

import './AdminTripsRoutesPage.css'

const provinceName = (location) =>
  location?.provinceRef?.name || location?.province || 'Chưa xác định'

const getLowestPrice = (route) => {
  const candidates = [
    route.lowestPrice,
    route.minPrice,
    route.minimumPrice,
    route.lowestTicketPrice,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0)

  return candidates.length ? Math.min(...candidates) : null
}

const getNearestDeparture = (route) =>
  route.nextDepartureTime ||
  route.nearestDepartureTime ||
  route.upcomingDepartureTime ||
  null

function AdminRoutesSummaryPage({ embedded = false, refreshKey = 0 }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, tripData] = await Promise.all([
        getRouteSummary(),
        getTrips({ page: 1, limit: 500, sort: 'asc' }).catch(() => ({ trips: [] })),
      ])

      const now = Date.now()
      const allTrips = tripData?.trips ?? []
      const enrichedRoutes = (data?.routes ?? []).map((route) => {
        const matchingTrips = allTrips.filter((trip) => {
          const departure = trip.departureLocation || trip.route?.departureLocation
          const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
          return (
            departure?.id === route.departureLocation?.id &&
            arrival?.id === route.arrivalLocation?.id &&
            trip.status !== 'CANCELLED'
          )
        })

        const prices = matchingTrips.flatMap((trip) => {
          const values = [trip.ticketPrice, trip.singleRoomPrice, trip.doubleRoomPrice]
          return values
            .map(Number)
            .filter((value) => Number.isFinite(value) && value > 0)
        })

        const nextDepartureTime = matchingTrips
          .filter(
            (trip) =>
              !['CANCELLED', 'COMPLETED'].includes(trip.status) &&
              new Date(trip.departureTime).getTime() >= now,
          )
          .map((trip) => trip.departureTime)
          .sort((left, right) => new Date(left) - new Date(right))[0] || null

        return {
          ...route,
          lowestPrice:
            route.lowestPrice ??
            route.minPrice ??
            (prices.length ? Math.min(...prices) : null),
          nextDepartureTime:
            route.nextDepartureTime ?? route.nearestDepartureTime ?? nextDepartureTime,
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
                {routes.map((route) => {
                  const lowestPrice = getLowestPrice(route)
                  const nearestDeparture = getNearestDeparture(route)

                  return (
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
                        {lowestPrice == null ? '—' : formatCurrency(lowestPrice)}
                      </td>
                      <td className="admin-route-mvc-nearest">
                        {nearestDeparture
                          ? formatDateTime(nearestDeparture)
                          : 'Chưa có chuyến sắp chạy'}
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

export default AdminRoutesSummaryPage
