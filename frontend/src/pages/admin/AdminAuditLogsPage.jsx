import { useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getAuditLogs } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

function AdminAuditLogsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      setData(await getAuditLogs({ page: 1, limit: 100 }))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <AdminPageHeader title="Nhật ký hệ thống" description="Chỉ Chủ xe được xem các thao tác quản trị." />
      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingState /> : data.logs.length === 0 ? <EmptyState message="Chưa có nhật ký thao tác." /> : (
        <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Quyền</th><th>Hành động</th><th>Đối tượng</th><th>Mô tả</th></tr></thead>
          <tbody>{data.logs.map((log) => (
            <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td><strong>{log.user?.fullName}</strong><small>{log.user?.email}</small></td><td>{log.role}</td><td>{log.action}</td><td>{log.entityType}<small>{log.entityId}</small></td><td>{log.description}</td></tr>
          ))}</tbody>
        </table></div></section>
      )}
    </>
  )
}

export default AdminAuditLogsPage
