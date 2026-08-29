import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import { createUser, getUsers, updateUser, updateUserRole } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatPhoneInput, isValidFullName, isVietnamesePhone, normalizeEmail, normalizeFullName, normalizePhone } from '../../utils/normalizers.js'

const EMPTY = { fullName: '', email: '', phone: '', password: '', role: 'STAFF' }
function AdminUserFormPage({ mode = 'create' }) {
  const { id } = useParams(); const navigate = useNavigate(); const { user: currentUser } = useAuth(); const editing = mode === 'edit'
  const [form, setForm] = useState({ ...EMPTY }); const [originalRole, setOriginalRole] = useState(''); const [loading, setLoading] = useState(editing); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [found, setFound] = useState(!editing)
  const load = useCallback(async () => { if (!editing) return; setLoading(true); setError(''); try { const data = await getUsers({ page: 1, limit: 100 }); const item = (data.users ?? []).find((row) => row.id === id); if (!item) throw new Error('Không tìm thấy tài khoản.'); setFound(true); setOriginalRole(item.role); setForm({ fullName: item.fullName || '', email: item.email || '', phone: formatPhoneInput(item.phone || ''), password: '', role: item.role || 'STAFF' }) } catch (e) { setFound(false); setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [editing, id])
  useEffect(() => { load() }, [load])
  const submit = async (event) => { event.preventDefault(); const payload = { fullName: normalizeFullName(form.fullName), email: normalizeEmail(form.email), phone: normalizePhone(form.phone), ...(form.password && { password: form.password }) }; if (!isValidFullName(payload.fullName)) return setError('Họ tên không hợp lệ.'); if (!isVietnamesePhone(payload.phone)) return setError('Số điện thoại Việt Nam không hợp lệ.'); setSaving(true); setError(''); try { if (editing) { await updateUser(id, payload); if (id !== currentUser?.id && originalRole !== form.role) await updateUserRole(id, form.role) } else await createUser({ ...payload, password: form.password, role: form.role }); navigate('/admin/tai-khoan', { replace: true }) } catch (e) { setError(getApiErrorMessage(e)) } finally { setSaving(false) } }
  if (loading) return <LoadingState />
  if (editing && !found) return <ErrorState message={error || 'Không tìm thấy tài khoản.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'} description="Thông tin tài khoản quản trị được chỉnh sửa ở trang riêng." /><section className="admin-panel">{error && <div className="alert alert-danger">{error}</div>}<form className="admin-form-grid" onSubmit={submit}>
    <label className="admin-field"><span>Họ tên</span><input className="form-control" required value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} /></label>
    <label className="admin-field"><span>Quyền</span><select className="form-select" disabled={editing && id === currentUser?.id} value={form.role} onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))}><option value="STAFF">Nhân viên quản trị</option><option value="ADMIN">Chủ xe</option></select></label>
    <label className="admin-field"><span>Email</span><input className="form-control" type="email" required value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label>
    <label className="admin-field"><span>Số điện thoại</span><input className="form-control" inputMode="tel" maxLength={12} required value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: formatPhoneInput(e.target.value) }))} /></label>
    <label className="admin-field admin-field--wide"><span>{editing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu ban đầu'}</span><input className="form-control" minLength={8} required={!editing} type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} /></label>
    <div className="admin-field admin-field--wide admin-crud-actions"><Link className="btn btn-outline-secondary" to="/admin/tai-khoan">Hủy</Link><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
  </form></section></div>
}
export default AdminUserFormPage
