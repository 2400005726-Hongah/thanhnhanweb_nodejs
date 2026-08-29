import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { getDashboard } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatBookingCode, formatLicensePlate } from '../../utils/normalizers.js'
import { getStatusLabel } from '../../utils/uiLabels.js'

const formatToday = () =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

function AdminDashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const data = await getDashboard()
      setSummary(data.summary)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  useEffect(() => {
    load()
  }, [])

  const quickActions = useMemo(
    () => [
      {
        label: 'Thêm chuyến xe',
        note: 'Tạo lịch chạy mới',
        to: '/admin/chuyen-xe',
        permission: PERMISSIONS.CREATE_TRIPS,
        icon: '+',
      },
      {
        label: 'Quản lý vé xe',
        note: 'Xem và xử lý vé đã đặt',
        to: '/admin/ve-xe',
        permission: PERMISSIONS.VIEW_BOOKINGS,
        icon: '▤',
      },
      {
        label: 'Nhật ký hệ thống',
        note: 'Xem lịch sử thao tác nhân viên',
        to: '/admin/nhat-ky',
        permission: PERMISSIONS.VIEW_SYSTEM_LOGS,
        icon: '↶',
      },
      {
        label: 'Kiểm tra vé',
        note: 'Tra cứu thông tin vé',
        to: '/admin/kiem-tra-ve',
        permission: PERMISSIONS.VIEW_BOOKINGS,
        icon: '⌕',
      },
    ].filter((item) => hasPermission(user, item.permission)),
    [user],
  )

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!summary) return <LoadingState />

  const cards = [
    ['Tổng số xe', summary.totalBuses ?? 0, 'bus'],
    ['Tổng tuyến xe', summary.totalRoutes ?? 0, 'route'],
    ['Tổng chuyến xe', summary.totalTrips ?? 0, 'trip'],
    ['Tổng số vé', summary.totalBookings ?? 0, 'ticket'],
    ['Tổng khách hàng', summary.totalCustomers ?? 0, 'customer'],
    ['Chưa thanh toán', summary.unpaidBookings ?? 0, 'payment'],
    ['Chuyến sắp chạy', summary.upcomingTrips ?? 0, 'clock'],
    ...(summary.finance
      ? [['Tổng doanh thu', formatCurrency(summary.finance.revenue), 'money']]
      : []),
  ]

  const monthly = summary.finance?.monthlyRevenue || []
  const maxMonth = Math.max(...monthly.map(Number), 1)

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>Xin chào, {user?.role === 'ADMIN' ? 'Chủ xe' : user?.fullName}</h2>
          <p>Tổng hợp hoạt động vận hành của Nhà xe Thành Nhân.</p>
        </div>
        <time dateTime={new Date().toISOString()}>◫ {formatToday()}</time>
      </div>

      <div className="admin-stat-grid dashboard-stat-grid dashboard-stat-grid--8">
        {cards.map(([label, value, tone]) => (
          <article className={`admin-stat-card dashboard-stat-card dashboard-stat-card--${tone}`} key={label}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              {label === 'Chuyến sắp chạy' && <small>Trong 30 ngày tới</small>}
              {label === 'Tổng doanh thu' && summary.finance && (
                <small className={summary.finance.revenueChangePercent >= 0 ? 'text-success' : 'text-danger'}>
                  {summary.finance.revenueChangePercent >= 0 ? '↑' : '↓'} {Math.abs(summary.finance.revenueChangePercent)}% so với tháng trước
                </small>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid--mvc">
        <section className="admin-panel dashboard-chart-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Doanh thu theo tháng</h2>
              <p>Năm {summary.finance?.year || new Date().getFullYear()}</p>
            </div>
            {summary.finance && (
              <div className="dashboard-current-month">
                <span>Doanh thu tháng này</span>
                <strong>{formatCurrency(summary.finance.currentMonthRevenue)}</strong>
              </div>
            )}
          </div>

          {summary.finance ? (
            <div className="monthly-revenue-chart" aria-label="Biểu đồ doanh thu 12 tháng">
              {monthly.map((value, index) => (
                <div className="monthly-revenue-column" key={`month-${index + 1}`}>
                  <div className="monthly-revenue-track">
                    <i style={{ height: `${Math.max(value ? 4 : 0, (Number(value) / maxMonth) * 100)}%` }} />
                  </div>
                  <strong>T{index + 1}</strong>
                  <small>{value ? formatCurrency(value) : '0 đ'}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-staff-note">Dữ liệu doanh thu chỉ hiển thị cho Chủ xe.</div>
          )}
        </section>

        <section className="admin-panel dashboard-quick-panel">
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

      <div className="dashboard-grid dashboard-grid--mvc dashboard-grid--bottom">
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

        <section className="admin-panel dashboard-upcoming-panel">
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
