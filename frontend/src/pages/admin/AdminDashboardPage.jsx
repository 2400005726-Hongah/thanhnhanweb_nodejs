import { useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getDashboard } from '../../services/admin.service.js'
import formatCurrency from '../../utils/formatCurrency.js'

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

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!summary) return <LoadingState />

  const cards = [
    ['Chuyến hôm nay', summary.tripsToday],
    ['Chuyến sắp chạy', summary.upcomingTrips],
    ['Vé tạo hôm nay', summary.bookingsToday],
    ['Ghế đã đặt', summary.bookedSeats],
    ['Xe hoạt động', summary.activeBuses],
    ['Khách hàng', summary.activeCustomers],
  ]

  return (
    <>
      <AdminPageHeader
        title={user?.role === 'ADMIN' ? 'Tổng quan nhà xe' : 'Tổng quan vận hành'}
        description="Dữ liệu được tổng hợp trực tiếp từ hệ thống đặt vé."
      />
      <div className="admin-stat-grid">
        {cards.map(([label, value]) => (
          <article className="admin-stat-card" key={label}>
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
          </article>
        ))}
      </div>
      {summary.finance && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>CHỈ CHỦ XE</span>
              <h2>Tài chính</h2>
            </div>
          </div>
          <div className="admin-stat-grid admin-stat-grid--finance">
            <article className="admin-stat-card admin-stat-card--money">
              <span>Doanh thu thành công</span>
              <strong>{formatCurrency(summary.finance.revenue)}</strong>
            </article>
            <article className="admin-stat-card">
              <span>Thanh toán thành công</span>
              <strong>{summary.finance.successfulPayments}</strong>
            </article>
            <article className="admin-stat-card admin-stat-card--refund">
              <span>Đã hoàn tiền</span>
              <strong>{formatCurrency(summary.finance.refundedAmount)}</strong>
            </article>
          </div>
        </section>
      )}
    </>
  )
}

export default AdminDashboardPage
