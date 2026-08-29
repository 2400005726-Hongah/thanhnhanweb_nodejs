import { useCallback, useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getAuditLogs } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import {
  getAuditActionLabel,
  getAuditEntityLabel,
  getRoleLabel,
  translateAuditDescription,
} from '../../utils/auditLabels.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

const initialFilters = { keyword: '', role: '', action: '', entityType: '', from: '', to: '' }

function AdminAuditLogsPage() {
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState(initialFilters)
  const [applied, setApplied] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await getAuditLogs({
        page,
        limit: 50,
        ...(applied.keyword && { keyword: applied.keyword }),
        ...(applied.role && { role: applied.role }),
        ...(applied.action && { action: applied.action }),
        ...(applied.entityType && { entityType: applied.entityType }),
        ...(applied.from && { from: applied.from }),
        ...(applied.to && { to: applied.to }),
      })
      setData(result)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }, [applied, page])

  useEffect(() => { load() }, [load])

  const submit = (event) => {
    event.preventDefault()
    setPage(1)
    setApplied(filters)
  }

  const clear = () => {
    setFilters(initialFilters)
    setApplied(initialFilters)
    setPage(1)
  }

  return (
    <>
      <AdminPageHeader title="Nhật ký hệ thống" description="Tra cứu thao tác quản trị theo từ khóa, hành động, đối tượng và khoảng thời gian." />

      <form className="admin-filter-bar" onSubmit={submit}>
        <input className="form-control" placeholder="Người thực hiện, mã, lý do, nội dung..." value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} />
        <select className="form-select" value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}><option value="">Tất cả vai trò</option><option value="ADMIN">Chủ xe</option><option value="STAFF">Nhân viên quản trị</option></select>
        <input className="form-control" placeholder="Hành động" value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} />
        <input className="form-control" placeholder="Đối tượng (BOOKING, CUSTOMER...)" value={filters.entityType} onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))} />
        <label className="admin-field"><span>Từ ngày</span><input className="form-control" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
        <label className="admin-field"><span>Đến ngày</span><input className="form-control" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
        <div className="d-flex gap-2"><button className="btn btn-primary" type="submit">Lọc nhật ký</button><button className="btn btn-outline-secondary" onClick={clear} type="button">Xóa lọc</button></div>
      </form>

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingState /> : data.logs.length === 0 ? <EmptyState message="Chưa có nhật ký phù hợp." /> : (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>NHẬT KÝ</span><h2>Kết quả theo bộ lọc</h2></div><strong>{data.pagination?.total ?? data.logs.length} kết quả</strong></div>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Quyền</th><th>Hành động</th><th>Đối tượng</th><th>Mô tả / lý do</th></tr></thead>
            <tbody>{data.logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.createdAt)}</td>
                <td><strong>{log.user?.fullName || log.actorName || 'Hệ thống'}</strong><small>{log.user?.email || 'Không có email'}</small></td>
                <td><span className="status-badge">{getRoleLabel(log.role)}</span></td>
                <td><strong>{getAuditActionLabel(log.action)}</strong></td>
                <td><strong>{getAuditEntityLabel(log.entityType)}</strong><small>Mã: {log.entityId ? String(log.entityId).slice(0, 8).toUpperCase() : '—'}</small></td>
                <td>{translateAuditDescription(log.description)}{log.reason && <small>Lý do: {log.reason}</small>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {(data.pagination?.totalPages ?? 1) > 1 && <div className="admin-pagination"><button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Trang trước</button><strong>Trang {data.pagination.page}/{data.pagination.totalPages}</strong><button className="btn btn-outline-secondary" disabled={page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Trang sau</button></div>}
        </section>
      )}
    </>
  )
}

export default AdminAuditLogsPage
