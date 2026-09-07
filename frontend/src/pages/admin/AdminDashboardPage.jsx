import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { getDashboard, getRevenue } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatBookingCode, formatLicensePlate } from '../../utils/normalizers.js'
import { getStatusLabel } from '../../utils/uiLabels.js'
import { RevenueTicketsChart } from './AdminAnalyticsCharts.jsx'
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

const formatToday = () =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

const unwrapRevenueReport = (response) => response?.summary || response || {}

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

function AdminDashboardPage() {
  const { user } = useAuth()
  const now = useMemo(() => new Date(), [])
  const [summary, setSummary] = useState(null)
  const [periodReport, setPeriodReport] = useState(null)
  const [periodLoading, setPeriodLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [error, setError] = useState('')

  const years = useMemo(() => {
    const current = now.getFullYear()
    return Array.from({ length: 5 }, (_, index) => current - 2 + index)
  }, [now])

  const load = async () => {
    setError('')
    try {
      const data = await getDashboard()
      setSummary(data.summary)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  const loadPeriod = async (year = selectedYear, month = selectedMonth) => {
    if (user?.role !== 'ADMIN') return
    setPeriodLoading(true)
    try {
      const response = await getRevenue(monthRange(year, month))
      setPeriodReport(unwrapRevenueReport(response))
    } catch {
      setPeriodReport(null)
    } finally {
      setPeriodLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    loadPeriod(selectedYear, selectedMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, user?.role])

  const quickActions = useMemo(
    () => [
      { label: 'Thêm chuyến xe', note: 'Tạo lịch chạy mới', to: '/admin/chuyen-xe', permission: PERMISSIONS.CREATE_TRIPS, icon: '+' },
      { label: 'Quản lý vé xe', note: 'Xem và xử lý vé đã đặt', to: '/admin/ve-xe', permission: PERMISSIONS.VIEW_BOOKINGS, icon: '▤' },
      { label: 'Nhật ký hệ thống', note: 'Xem lịch sử thao tác nhân viên', to: '/admin/nhat-ky', permission: PERMISSIONS.VIEW_SYSTEM_LOGS, icon: '↶' },
      { label: 'Kiểm tra vé', note: 'Tra cứu thông tin vé', to: '/admin/kiem-tra-ve', permission: PERMISSIONS.VIEW_BOOKINGS, icon: '⌕' },
    ].filter((item) => hasPermission(user, item.permission)),
    [user],
  )

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!summary) return <LoadingState />

  const periodSummary = periodReport?.summary || {}
  const periodDaily = fillMonthDailySeries(periodReport?.daily || [], selectedYear, selectedMonth)
  const finance = summary.finance
  const periodRevenue = user?.role === 'ADMIN'
    ? Number(periodSummary.revenue ?? 0)
    : Number(finance?.currentMonthRevenue ?? 0)

  const cards = [
    { label: 'Tổng số xe', value: summary.totalBuses ?? 0, icon: '▣', tone: '' },
    { label: 'Tổng tuyến xe', value: summary.totalRoutes ?? 0, icon: '⌘', tone: '' },
    { label: 'Chuyến trong kỳ', value: periodSummary.totalTrips ?? summary.totalTrips ?? 0, icon: '▰', tone: '' },
    { label: 'Vé trong kỳ', value: periodSummary.totalBookings ?? summary.totalBookings ?? 0, icon: '▤', tone: 'is-green' },
    { label: 'Khách trong kỳ', value: periodSummary.actualPassengerSeats ?? summary.totalCustomers ?? 0, icon: '●', tone: 'is-dark' },
    { label: 'Chưa thanh toán trong kỳ', value: periodSummary.pendingPayments ?? summary.unpaidBookings ?? 0, icon: '▧', tone: 'is-yellow' },
    { label: 'Chuyến sắp chạy', value: summary.upcomingTrips ?? 0, icon: '◷', tone: 'is-dark', note: 'Trong 30 ngày tới' },
    { label: 'Doanh thu trong kỳ', value: formatCurrency(periodRevenue), icon: '₫', tone: 'is-green is-money' },
  ]

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>Xin chào, {user?.role === 'ADMIN' ? 'Chủ xe' : user?.fullName}</h2>
          <p>Tổng hợp hoạt động vận hành của Nhà xe Thành Nhân.</p>
        </div>
        <div className="analytics-period-control">
          <time dateTime={new Date().toISOString()}>{formatToday()}</time>
          {user?.role === 'ADMIN' && (
            <>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} aria-label="Tháng thống kê">
                {Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index + 1}>Tháng {index + 1}</option>)}
              </select>
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} aria-label="Năm thống kê">
                {years.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="admin-stat-grid dashboard-stat-grid dashboard-stat-grid--8">
        {cards.map((card) => (
          <article className={`admin-stat-card analytics-stat-card ${card.tone}`} data-icon={card.icon} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            {card.note && <small>{card.note}</small>}
          </article>
        ))}
      </div>

      <div className="analytics-dashboard-grid">
        <section className="admin-panel analytics-dashboard-chart-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Doanh thu theo ngày</h2>
              <p>Tháng {String(selectedMonth).padStart(2, '0')}/{selectedYear}</p>
            </div>
            <div className="analytics-current-revenue">
              <span>Doanh thu tháng</span>
              <strong>{formatCurrency(periodRevenue)}</strong>
            </div>
          </div>
          {periodLoading ? (
            <div className="analytics-chart-empty">Đang tải biểu đồ...</div>
          ) : user?.role === 'ADMIN' ? (
            <RevenueTicketsChart items={periodDaily} height={315} />
          ) : (
            <div className="dashboard-staff-note">Dữ liệu doanh thu chỉ hiển thị cho Chủ xe.</div>
          )}
        </section>

        <section className="admin-panel dashboard-quick-panel analytics-dashboard-side-panel">
          <div className="admin-panel-heading"><div><h2>Thao tác nhanh</h2></div></div>
          <div className="dashboard-quick-actions">
            {quickActions.map((action) => (
              <Link key={action.to} to={action.to}>
                <span aria-hidden="true">{action.icon}</span>
                <div><strong>{action.label}</strong><small>{action.note}</small></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="analytics-dashboard-grid">
        <section className="admin-panel dashboard-recent-panel">
          <div className="admin-panel-heading">
            <div><h2>Vé mới đặt gần đây</h2></div>
            <Link to="/admin/ve-xe">Xem tất cả</Link>
          </div>
          <div className="table-responsive">
            <table className="table admin-table align-middle">
              <thead><tr><th>Mã vé</th><th>Khách hàng</th><th>Tuyến đường</th><th>Ngày đặt</th><th>Thành tiền</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {(summary.recentBookings || []).map((booking) => (
                  <tr key={booking.bookingCode}>
                    <td><Link to={`/admin/ve-xe/${booking.bookingCode}`}>{formatBookingCode(booking.bookingCode)}</Link></td>
                    <td>{booking.passengerFullName}</td>
                    <td>{booking.routeName}</td>
                    <td>{formatDateTime(booking.createdAt)}</td>
                    <td><strong>{formatCurrency(booking.totalAmount)}</strong></td>
                    <td><span className="status-chip">{getStatusLabel(booking.status)}</span></td>
                  </tr>
                ))}
                {!summary.recentBookings?.length && <tr><td colSpan="6" className="text-center text-muted">Chưa có vé.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel dashboard-upcoming-panel analytics-dashboard-side-panel">
          <div className="admin-panel-heading"><div><h2>Chuyến sắp khởi hành</h2></div><Link to="/admin/chuyen-xe">Quản lý</Link></div>
          <div className="dashboard-upcoming-list">
            {(summary.upcomingTripList || []).map((trip) => (
              <article key={trip.id}>
                <strong>{trip.routeName || trip.route?.routeName || 'Chưa xác định hành trình'}</strong>
                <span>{formatDateTime(trip.departureTime)}</span>
                <small>{trip.bus?.busName || 'Xe chưa xác định'}{trip.bus?.licensePlate ? ` · ${formatLicensePlate(trip.bus.licensePlate)}` : ''}</small>
              </article>
            ))}
            {!summary.upcomingTripList?.length && <p className="text-muted mb-0">Không có chuyến sắp khởi hành.</p>}
          </div>
        </section>
      </div>
    </>
  )
}

export default AdminDashboardPage
