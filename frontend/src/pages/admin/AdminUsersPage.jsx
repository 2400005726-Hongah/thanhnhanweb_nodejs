import { useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  createUser,
  getUsers,
  updateUserStatus,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'STAFF',
}

function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getUsers({ page: 1, limit: 100 })
      setUsers(data.users)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createUser(form)
      setForm(initialForm)
      await load()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (user) => {
    const status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!window.confirm(`Chuyển tài khoản ${user.email} sang ${status}?`)) return
    try {
      await updateUserStatus(user.id, status)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  return (
    <>
      <AdminPageHeader title="Tài khoản quản trị" description="Chỉ Chủ xe được tạo, khóa hoặc mở tài khoản ADMIN/STAFF." />
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span>TÀI KHOẢN</span><h2>Tạo tài khoản quản trị</h2></div></div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field"><span>Họ tên</span><input className="form-control" name="fullName" onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required value={form.fullName} /></label>
          <label className="admin-field"><span>Quyền</span><select className="form-select" onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} value={form.role}><option value="STAFF">Nhân viên quản trị</option><option value="ADMIN">Chủ xe</option></select></label>
          <label className="admin-field"><span>Email</span><input className="form-control" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required type="email" value={form.email} /></label>
          <label className="admin-field"><span>Số điện thoại</span><input className="form-control" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required value={form.phone} /></label>
          <label className="admin-field admin-field--wide"><span>Mật khẩu ban đầu</span><input className="form-control" minLength="8" onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required type="password" value={form.password} /></label>
          <div className="admin-field admin-field--wide"><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Đang tạo...' : 'Tạo tài khoản'}</button></div>
        </form>
      </section>
      {loading ? <LoadingState /> : users.length === 0 ? <EmptyState /> : (
        <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Quyền</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th>Thao tác</th></tr></thead>
          <tbody>{users.map((user) => (
            <tr key={user.id}><td><strong>{user.fullName}</strong></td><td>{user.email}<small>{user.phone}</small></td><td>{user.role === 'ADMIN' ? 'Chủ xe' : user.role === 'STAFF' ? 'Nhân viên quản trị' : 'Khách hàng'}</td><td>{user.status}</td><td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa đăng nhập'}</td><td><div className="admin-row-actions"><button className={user.status === 'ACTIVE' ? 'is-danger' : ''} onClick={() => toggleStatus(user)} type="button">{user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button></div></td></tr>
          ))}</tbody>
        </table></div></section>
      )}
    </>
  )
}

export default AdminUsersPage
