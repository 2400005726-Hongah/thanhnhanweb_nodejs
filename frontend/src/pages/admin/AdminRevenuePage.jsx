import { useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getRevenue } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'

function AdminRevenuePage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const data = await getRevenue()
      setSummary(data.summary)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  useEffect(() => { load() }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!summary) return <LoadingState />

  return (
    <>
      <AdminPageHeader title="Thống kê tài chính" description="Nội dung nhạy cảm, chỉ Chủ xe được phép xem." />
      <div className="admin-stat-grid">
        <article className="admin-stat-card admin-stat-card--money"><span>Doanh thu thành công</span><strong>{formatCurrency(summary.revenue)}</strong></article>
        <article className="admin-stat-card"><span>Giao dịch thành công</span><strong>{summary.successfulPayments}</strong></article>
        <article className="admin-stat-card admin-stat-card--refund"><span>Tiền đã hoàn</span><strong>{formatCurrency(summary.refundedAmount)}</strong></article>
        <article className="admin-stat-card"><span>Giao dịch hoàn tiền</span><strong>{summary.refundedPayments}</strong></article>
      </div>
    </>
  )
}

export default AdminRevenuePage
