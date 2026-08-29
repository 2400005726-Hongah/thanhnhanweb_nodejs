import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { getUsers, updateUserStatus } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { getStatusLabel } from '../../utils/uiLabels.js'
import { formatPhoneInput } from '../../utils/normalizers.js'

function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { const data = await getUsers({ page: 1, limit: 100 }); setUsers(data.users ?? []) }
    catch (requestError) { setError(getApiErrorMessage(requestError)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const toggleStatus = async (user) => {
    const status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!window.confirm(`${status === 'ACTIVE' ? 'Mở khóa' : 'Khóa'} tài khoản ${user.email}?`)) return
    setProcessingId(user.id)
    try { await updateUserStatus(user.id, status); await load() }
    catch (requestError) { window.alert(getApiErrorMessage(requestError)) }
    finally { setProcessingId('') }
  }

  return <>
    <AdminPageHeader title="Tài khoản quản trị" description="Danh sách tài khoản. Thêm, sửa và xóa mở ở trang riêng." actions={<Link className="btn btn-primary" to="/admin/tai-khoan/them">+ Thêm tài khoản</Link>} />
    {error && <ErrorState message={error} onRetry={load} />}
    {loading ? <LoadingState /> : users.length === 0 ? <EmptyState message="Chưa có tài khoản quản trị." /> : <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table">
      <thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Quyền</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th>Thao tác</th></tr></thead>
      <tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.fullName}</strong>{user.id === currentUser?.id && <small>Tài khoản đang đăng nhập</small>}</td><td>{user.email}<small>{formatPhoneInput(user.phone)}</small></td><td>{user.role === 'ADMIN' ? 'Chủ xe' : 'Nhân viên quản trị'}</td><td><span className={`status-badge status-badge--${String(user.status || '').toLowerCase()}`}>{getStatusLabel(user.status)}</span></td><td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa đăng nhập'}</td><td><div className="admin-row-actions"><Link to={`/admin/tai-khoan/${user.id}/sua`}>Sửa</Link><button className={user.status === 'ACTIVE' ? 'is-danger' : ''} disabled={processingId === user.id || (user.id === currentUser?.id && user.status === 'ACTIVE')} onClick={() => toggleStatus(user)} type="button">{user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button><Link className="is-danger" aria-disabled={user.id === currentUser?.id} onClick={(event) => { if (user.id === currentUser?.id) event.preventDefault() }} to={`/admin/tai-khoan/${user.id}/xoa`}>Xóa</Link></div></td></tr>)}</tbody>
    </table></div></section>}
  </>
}
export default AdminUsersPage
