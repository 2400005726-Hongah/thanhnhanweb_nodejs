import { useEffect, useMemo, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getRevenue } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'
import { getPaymentMethodLabel } from '../../utils/paymentLabels.js'
import { getStatusLabel } from '../../utils/uiLabels.js'
import { DonutChart, HorizontalBarsChart, RevenueTicketsChart } from './AdminAnalyticsCharts.jsx'
import './AdminAnalytics.css'

const inputDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const monthRange = (year, month) => ({
  from: inputDate(new Date(Number(year), Number(month) - 1, 1)),
  to: inputDate(new Date(Number(year), Number(month), 0)),
})

const yearRange = (year) => ({ from: `${year}-01-01`, to: `${year}-12-31` })

const formatRange = ({ from, to }) => {
  const formatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const safeDate = (value) => new Date(`${value}T00:00:00`)
  return `${formatter.format(safeDate(from))} – ${formatter.format(safeDate(to))}`
}


const fillMonthDailySeries = (items = [], year, month) => {
  const safeYear = Number(year)
  const safeMonth = Number(month)
  const daysInMonth = new Date(safeYear, safeMonth, 0).getDate()
  const byDate = new Map(
    items.map((item) => [String(item.date || '').slice(0, 10), item]),
  )

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    const monthText = String(safeMonth).padStart(2, '0')
    const date = `${safeYear}-${monthText}-${day}`
    const current = byDate.get(date)

    return {
      ...(current || {}),
      date,
      revenue: Number(current?.revenue || 0),
      bookings: Number(current?.bookings || 0),
    }
  })
}

const sourceLabel = (item) => {
  const key = String(item.key || '').toUpperCase()
  if (key === 'ONLINE') return 'Online'
  if (key === 'COUNTER') return 'Tại quầy'
  if (key === 'HOTLINE') return 'Hotline'
  return item.label || item.key || 'Khác'
}

function AdminRevenuePage() {
  const now = useMemo(() => new Date(), [])
  const [filterMode, setFilterMode] = useState('month')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [customRange, setCustomRange] = useState(monthRange(now.getFullYear(), now.getMonth() + 1))
  const [appliedFilters, setAppliedFilters] = useState(monthRange(now.getFullYear(), now.getMonth() + 1))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const years = useMemo(() => {
    const current = now.getFullYear()
    return Array.from({ length: 6 }, (_, index) => current - 3 + index)
  }, [now])

  const buildFilters = () => {
    if (filterMode === 'year') return yearRange(year)
    if (filterMode === 'range') return customRange
    return monthRange(year, month)
  }

  const load = async (nextFilters) => {
    setLoading(true)
    setError('')
    try {
      const response = await getRevenue(nextFilters)
      setData(response.summary || response || {})
      setAppliedFilters(nextFilters)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(monthRange(now.getFullYear(), now.getMonth() + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (event) => {
    event.preventDefault()
    load(buildFilters())
  }

  const applyThisMonth = () => {
    const current = new Date()
    const nextMonth = current.getMonth() + 1
    const nextYear = current.getFullYear()
    setFilterMode('month')
    setMonth(nextMonth)
    setYear(nextYear)
    load(monthRange(nextYear, nextMonth))
  }

  const applyThisYear = () => {
    const nextYear = new Date().getFullYear()
    setFilterMode('year')
    setYear(nextYear)
    load(yearRange(nextYear))
  }

  if (loading && !data) return <LoadingState label="Đang tổng hợp báo cáo thống kê..." />
  if (error && !data) return <ErrorState message={error} onRetry={() => load(appliedFilters)} />

  const report = data || {}
  const summary = report.summary || {
    revenue: report.revenue || 0,
    refundedAmount: report.refundedAmount || 0,
  }
  const rawDaily = report.daily || []
  const appliedFrom = String(appliedFilters.from || '')
  const appliedTo = String(appliedFilters.to || '')
  const appliedStart = new Date(`${appliedFrom}T00:00:00`)
  const appliedEnd = new Date(`${appliedTo}T00:00:00`)
  const appliedIsFullMonth =
    appliedFrom &&
    appliedTo &&
    appliedStart.getDate() === 1 &&
    appliedStart.getFullYear() === appliedEnd.getFullYear() &&
    appliedStart.getMonth() === appliedEnd.getMonth() &&
    appliedEnd.getDate() === new Date(
      appliedEnd.getFullYear(),
      appliedEnd.getMonth() + 1,
      0,
    ).getDate()

  const daily = appliedIsFullMonth
    ? fillMonthDailySeries(
        rawDaily,
        appliedStart.getFullYear(),
        appliedStart.getMonth() + 1,
      )
    : rawDaily

  return (
    <>
      <AdminPageHeader
        title="Báo cáo thống kê"
        description="Dữ liệu được tổng hợp theo ngày khởi hành của chuyến xe."
        actions={<span className="analytics-chart-badge">{formatRange(appliedFilters)}</span>}
      />

      <form className="admin-panel analytics-filter-panel" onSubmit={submit}>
        <label>
          <span>Kiểu thống kê</span>
          <select className="form-select" value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
            <option value="month">Theo tháng</option>
            <option value="year">Theo năm</option>
            <option value="range">Khoảng ngày</option>
          </select>
        </label>

        {filterMode === 'month' && (
          <label>
            <span>Tháng</span>
            <select className="form-select" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index + 1}>Tháng {index + 1}</option>)}
            </select>
          </label>
        )}

        {filterMode !== 'range' && (
          <label>
            <span>Năm</span>
            <select className="form-select" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        )}

        {filterMode === 'range' && (
          <>
            <label>
              <span>Từ ngày</span>
              <input className="form-control" type="date" value={customRange.from} onChange={(event) => setCustomRange((current) => ({ ...current, from: event.target.value }))} required />
            </label>
            <label>
              <span>Đến ngày</span>
              <input className="form-control" type="date" value={customRange.to} onChange={(event) => setCustomRange((current) => ({ ...current, to: event.target.value }))} required />
            </label>
          </>
        )}

        <button className="btn btn-danger" disabled={loading} type="submit">{loading ? 'Đang tải...' : 'Xem thống kê'}</button>
        <button className="btn btn-outline-danger" onClick={applyThisMonth} type="button">Tháng này</button>
        <button className="btn btn-outline-secondary" onClick={applyThisYear} type="button">Năm nay</button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="analytics-rule-note">
        <strong>Doanh thu thực nhận</strong> chỉ cộng thanh toán trạng thái Đã thanh toán; vé đã hoàn tiền và thanh toán tại xe đang Chờ xử lý không tính vào doanh thu.
      </div>

      <div className="analytics-stats-grid">
        <article className="admin-stat-card analytics-stat-card is-refund" data-icon="₫"><span>Doanh thu thực nhận</span><strong>{formatCurrency(summary.revenue)}</strong></article>
        <article className="admin-stat-card analytics-stat-card is-dark" data-icon="↶"><span>Tiền đã hoàn</span><strong>{formatCurrency(summary.refundedAmount)}</strong></article>
        <article className="admin-stat-card analytics-stat-card" data-icon="▤"><span>Tổng vé</span><strong>{summary.totalBookings ?? 0}</strong><small>Không gồm {summary.deletedBookings ?? 0} vé đã xóa</small></article>
        <article className="admin-stat-card analytics-stat-card is-dark" data-icon="▰"><span>Tổng chuyến</span><strong>{summary.totalTrips ?? 0}</strong></article>
        <article className="admin-stat-card analytics-stat-card is-green" data-icon="✓"><span>Đã thanh toán</span><strong>{summary.paidBookings ?? report.successfulPayments ?? 0}</strong></article>
        <article className="admin-stat-card analytics-stat-card is-yellow" data-icon="!"><span>Chưa thanh toán</span><strong>{summary.pendingPayments ?? 0}</strong></article>
        <article className="admin-stat-card analytics-stat-card" data-icon="⊘"><span>Hủy / Không đi</span><strong>{(summary.cancelledBookings || 0) + (summary.noShowBookings || 0)}</strong><small>Hủy {summary.cancelledBookings || 0} · Không đi {summary.noShowBookings || 0}</small></article>
        <article className="admin-stat-card analytics-stat-card" data-icon="▥"><span>Tỷ lệ lấp đầy thực tế</span><strong>{summary.occupancyRate ?? 0}%</strong><small>{summary.actualPassengerSeats ?? 0} / {summary.totalCapacity ?? 0} vị trí thực tế · Đã bán {summary.seatsSold ?? 0}</small></article>
      </div>

      <div className="analytics-stats-main-grid">
        <section className="admin-panel analytics-chart-panel">
          <div className="admin-panel-heading">
            <div><h2>Doanh thu</h2><p>Theo ngày khởi hành</p></div>
            <span className="analytics-chart-badge">Theo ngày</span>
          </div>
          <RevenueTicketsChart items={daily} height={330} />
        </section>

        <section className="admin-panel analytics-chart-panel">
          <div className="admin-panel-heading"><div><h2>Trạng thái vé</h2></div></div>
          <DonutChart
            items={report.statusDistribution || []}
            centerLabel="vé"
            labelFormatter={(item) => item.label || getStatusLabel(item.key)}
          />
        </section>
      </div>

      <div className="analytics-stats-secondary-grid">
        <section className="admin-panel analytics-chart-panel">
          <div className="admin-panel-heading"><div><h2>Nguồn đặt vé</h2></div></div>
          <DonutChart items={report.sourceDistribution || []} centerLabel="vé" labelFormatter={sourceLabel} />
        </section>

        <section className="admin-panel analytics-chart-panel">
          <div className="admin-panel-heading"><div><h2>Phương thức thanh toán</h2></div></div>
          <HorizontalBarsChart
            items={report.paymentMethodDistribution || []}
            labelFormatter={(item) => item.key === 'UNPAID' ? 'Chưa có thanh toán' : getPaymentMethodLabel(item.key)}
          />
        </section>
      </div>

      <section className="admin-panel stats-table-panel analytics-table-panel">
        <div className="admin-panel-heading">
          <div><h2>Thống kê theo tỉnh/thành</h2></div>
          <small>{report.provincePerformance?.length || 0} hành trình cấp tỉnh</small>
        </div>
        <div className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Tỉnh/Thành đi</th><th>Tỉnh/Thành đến</th><th>Số chuyến</th><th>Số vé</th><th>Khách thực tế</th><th>Doanh thu</th></tr></thead>
            <tbody>
              {(report.provincePerformance || []).map((item) => (
                <tr key={item.key}>
                  <td><strong>{item.departureProvinceName}</strong></td>
                  <td><strong>{item.arrivalProvinceName}</strong></td>
                  <td>{item.trips}</td><td>{item.bookings}</td><td>{item.actualPassengerSeats}</td>
                  <td><strong className="text-danger">{formatCurrency(item.revenue)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel stats-table-panel analytics-table-panel">
        <div className="admin-panel-heading"><div><h2>Hiệu quả theo tuyến đường</h2></div><small>{report.routePerformance?.length || 0} tuyến có chuyến trong khoảng đã chọn</small></div>
        <div className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Tuyến đường</th><th>Số chuyến</th><th>Số vé</th><th>Hủy / Không đi</th><th>Lấp đầy</th><th>Doanh thu</th></tr></thead>
            <tbody>
              {(report.routePerformance || []).map((route) => (
                <tr key={route.routeId}>
                  <td><strong>{route.routeName}</strong></td><td>{route.trips}</td><td>{route.bookings}</td><td>{route.cancelledOrNoShow}</td>
                  <td><div className="stats-occupancy"><div><i style={{ width: `${route.occupancyRate}%` }} /></div><strong>{route.occupancyRate}%</strong><small>{route.actualPassengerSeats} / {route.capacity} khách thực tế · Đã bán {route.seatsSold} vị trí</small></div></td>
                  <td><strong className="text-danger">{formatCurrency(route.revenue)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel stats-table-panel analytics-table-panel">
        <div className="admin-panel-heading"><div><h2>Top 10 chuyến theo doanh thu</h2></div><small>Xếp theo doanh thu, sau đó số vị trí đã bán</small></div>
        <div className="table-responsive">
          <table className="table admin-table align-middle">
            <thead><tr><th>Chuyến</th><th>Xe</th><th>Thời gian khởi hành</th><th>Số vé</th><th>Lấp đầy</th><th>Doanh thu</th></tr></thead>
            <tbody>
              {(report.topTrips || []).map((trip) => (
                <tr key={trip.id}>
                  <td><strong>{trip.routeName}</strong><small className="d-block text-muted">Mã chuyến {trip.id.slice(0, 8).toUpperCase()}</small></td>
                  <td>{trip.busName}<small className="d-block">{formatLicensePlate(trip.licensePlate)}</small></td>
                  <td>{formatDateTime(trip.departureTime)}</td><td>{trip.bookings}</td>
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
