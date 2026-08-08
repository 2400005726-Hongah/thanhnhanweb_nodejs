import { useEffect, useMemo, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getRevenue } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'
import { getPaymentMethodLabel } from '../../utils/paymentLabels.js'

const inputDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const currentMonthRange = () => {
  const now = new Date()
  return {
    from: inputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: inputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

const currentYearRange = () => {
  const now = new Date()
  return {
    from: `${now.getFullYear()}-01-01`,
    to: `${now.getFullYear()}-12-31`,
  }
}

function DistributionBars({ items, labelFormatter = (item) => item.label || item.key }) {
  const max = Math.max(...items.map((item) => Number(item.count || 0)), 1)
  return (
    <div className="stats-distribution-list">
      {items.map((item) => (
        <div className="stats-distribution-row" key={item.key}>
          <span>{labelFormatter(item)}</span>
          <div><i style={{ width: `${(Number(item.count || 0) / max) * 100}%` }} /></div>
          <strong>{item.count || 0}</strong>
        </div>
      ))}
    </div>
  )
}

function AdminRevenuePage() {
  const initial = useMemo(currentMonthRange, [])
  const [filters, setFilters] = useState(initial)
  const [appliedFilters, setAppliedFilters] = useState(initial)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (nextFilters = appliedFilters) => {
    setLoading(true)
    setError('')
    try {
      const response = await getRevenue(nextFilters)
      setData(response.summary)
      setAppliedFilters(nextFilters)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const applyPreset = (range) => {
    setFilters(range)
    load(range)
  }

  if (loading && !data) return <LoadingState label="Đang tổng hợp báo cáo thống kê..." />
  if (error && !data) return <ErrorState message={error} onRetry={() => load(appliedFilters)} />

  const report = data || {}
  const summary = report.summary || {
    revenue: report.revenue || 0,
    refundedAmount: report.refundedAmount || 0,
  }
  const daily = report.daily || []
  const maxRevenue = Math.max(...daily.map((item) => Number(item.revenue || 0)), 1)
  const maxTickets = Math.max(...daily.map((item) => Number(item.bookings || 0)), 1)

  return (
    <>
      <AdminPageHeader
        title="Báo cáo thống kê"
        description="Phân tích theo ngày khởi hành của chuyến xe; doanh thu chỉ cộng các thanh toán Đã thanh toán."
      />

      <form className="admin-panel stats-filter-panel" onSubmit={submit}>
        <label><span>Từ ngày</span><input className="form-control" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} required /></label>
        <label><span>Đến ngày</span><input className="form-control" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} required /></label>
        <button className="btn btn-danger" disabled={loading} type="submit">{loading ? 'Đang tải...' : 'Xem thống kê'}</button>
        <button className="btn btn-outline-danger" onClick={() => applyPreset(currentMonthRange())} type="button">Tháng này</button>
        <button className="btn btn-outline-secondary" onClick={() => applyPreset(currentYearRange())} type="button">Năm nay</button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="stats-rule-note">
        <strong>Doanh thu thực nhận</strong> chỉ cộng thanh toán trạng thái Đã thanh toán.
        Vé đã hoàn tiền không được cộng vào doanh thu; thanh toán tại xe đang Chờ xử lý không được tính doanh thu.
      </div>

      <div className="admin-stat-grid stats-summary-grid">
        <article className="admin-stat-card admin-stat-card--money"><span>Doanh thu thực nhận</span><strong>{formatCurrency(summary.revenue)}</strong></article>
        <article className="admin-stat-card admin-stat-card--refund"><span>Tiền đã hoàn</span><strong>{formatCurrency(summary.refundedAmount)}</strong></article>
        <article className="admin-stat-card"><span>Tổng vé</span><strong>{summary.totalBookings ?? 0}</strong><small>Không gồm {summary.deletedBookings ?? 0} vé đã xóa</small></article>
        <article className="admin-stat-card"><span>Tổng chuyến</span><strong>{summary.totalTrips ?? 0}</strong></article>
        <article className="admin-stat-card"><span>Đã thanh toán</span><strong>{summary.paidBookings ?? report.successfulPayments ?? 0}</strong></article>
        <article className="admin-stat-card"><span>Chưa thanh toán</span><strong>{summary.pendingPayments ?? 0}</strong></article>
        <article className="admin-stat-card"><span>Hủy / Không đi</span><strong>{(summary.cancelledBookings || 0) + (summary.noShowBookings || 0)}</strong><small>Hủy {summary.cancelledBookings || 0} · Không đi {summary.noShowBookings || 0}</small></article>
        <article className="admin-stat-card"><span>Tỷ lệ lấp đầy thực tế</span><strong>{summary.occupancyRate ?? 0}%</strong><small>{summary.actualPassengerSeats ?? 0} / {summary.totalCapacity ?? 0} vị trí thực tế · Đã bán {summary.seatsSold ?? 0}</small></article>
      </div>

      <div className="stats-grid stats-grid--wide">
        <section className="admin-panel stats-daily-panel">
          <div className="admin-panel-heading"><div><h2>Doanh thu và số vé theo ngày</h2><p>Theo ngày khởi hành</p></div></div>
          <div className="stats-daily-chart">
            {daily.map((item) => (
              <div className="stats-day-column" key={item.date}>
                <div className="stats-day-plot">
                  <i className="stats-day-revenue" style={{ height: `${(Number(item.revenue || 0) / maxRevenue) * 100}%` }} />
                  <b style={{ bottom: `${(Number(item.bookings || 0) / maxTickets) * 100}%` }}>{item.bookings || 0}</b>
                </div>
                <strong>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</strong>
                <small>{formatCurrency(item.revenue)}</small>
              </div>
            ))}
            {!daily.length && <p className="text-muted">Không có chuyến trong khoảng đã chọn.</p>}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Trạng thái vé</h2></div></div>
          <DistributionBars items={report.statusDistribution || []} />
        </section>
      </div>

      <div className="stats-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Nguồn đặt vé</h2></div></div>
          <DistributionBars items={report.sourceDistribution || []} />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Phương thức thanh toán</h2></div></div>
          <DistributionBars
            items={report.paymentMethodDistribution || []}
            labelFormatter={(item) => item.key === 'UNPAID' ? 'Chưa có thanh toán' : getPaymentMethodLabel(item.key)}
          />
        </section>
      </div>

      <section className="admin-panel stats-table-panel">
        <div className="admin-panel-heading"><div><h2>Hiệu quả theo tuyến đường</h2></div><small>{report.routePerformance?.length || 0} tuyến có chuyến trong khoảng đã chọn</small></div>
        <div className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Tuyến đường</th><th>Số chuyến</th><th>Số vé</th><th>Hủy / Không đi</th><th>Lấp đầy</th><th>Doanh thu</th></tr></thead>
            <tbody>
              {(report.routePerformance || []).map((route) => (
                <tr key={route.routeId}>
                  <td><strong>{route.routeName}</strong></td>
                  <td>{route.trips}</td>
                  <td>{route.bookings}</td>
                  <td>{route.cancelledOrNoShow}</td>
                  <td><div className="stats-occupancy"><div><i style={{ width: `${route.occupancyRate}%` }} /></div><strong>{route.occupancyRate}%</strong><small>{route.actualPassengerSeats} / {route.capacity} khách thực tế · Đã bán {route.seatsSold} vị trí</small></div></td>
                  <td><strong className="text-danger">{formatCurrency(route.revenue)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel stats-table-panel">
        <div className="admin-panel-heading"><div><h2>Top 10 chuyến theo doanh thu</h2></div><small>Xếp theo doanh thu, sau đó số vị trí đã bán</small></div>
        <div className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Chuyến</th><th>Xe</th><th>Thời gian khởi hành</th><th>Số vé</th><th>Lấp đầy</th><th>Doanh thu</th></tr></thead>
            <tbody>
              {(report.topTrips || []).map((trip) => (
                <tr key={trip.id}>
                  <td><strong>{trip.routeName}</strong><small className="d-block text-muted">Mã chuyến {trip.id.slice(0, 8).toUpperCase()}</small></td>
                  <td>{trip.busName}<small className="d-block">{formatLicensePlate(trip.licensePlate)}</small></td>
                  <td>{formatDateTime(trip.departureTime)}</td>
                  <td>{trip.bookings}</td>
                  <td><div className="stats-occupancy"><div><i style={{ width: `${trip.occupancyRate}%` }} /></div><strong>{trip.occupancyRate}%</strong><small>{trip.actualPassengerSeats} / {trip.capacity} khách thực tế · Đã bán {trip.soldSeats} vị trí</small></div></td>
                  <td><strong className="text-danger">{formatCurrency(trip.revenue)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default AdminRevenuePage
