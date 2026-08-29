import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { getCustomerDetail, updateCustomer } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatPhoneInput, isValidFullName, isVietnamesePhone, normalizeEmail, normalizeFullName, normalizePhone } from '../../utils/normalizers.js'

function AdminCustomerEditPage() {
  const { id } = useParams(); const navigate = useNavigate(); const [form, setForm] = useState(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await getCustomerDetail(id); const customer = result?.customer ?? result; if (!customer?.id) throw new Error('Không tìm thấy khách hàng.'); setForm({ fullName: customer.fullName ?? '', phone: formatPhoneInput(customer.phone ?? ''), email: customer.email ?? '', note: customer.note ?? '' }) } catch (e) { setError(getApiErrorMessage(e)) } finally { setLoading(false) } }, [id])
  useEffect(() => { load() }, [load])
  const submit = async (event) => { event.preventDefault(); const fullName = normalizeFullName(form.fullName); const phone = normalizePhone(form.phone); const email = normalizeEmail(form.email); if (!isValidFullName(fullName)) return setError('Họ tên khách hàng không hợp lệ.'); if (!isVietnamesePhone(phone)) return setError('Số điện thoại Việt Nam không hợp lệ.'); setSaving(true); setError(''); try { await updateCustomer(id, { fullName, phone, email, note: form.note }); navigate(`/admin/khach-hang/${id}`, { replace: true }) } catch (e) { setError(getApiErrorMessage(e)) } finally { setSaving(false) } }
  if (loading) return <LoadingState />
  if (!form) return <ErrorState message={error || 'Không tìm thấy khách hàng.'} onRetry={load} />
  return <div className="admin-crud-page"><AdminPageHeader title="Sửa khách hàng" description="Thông tin khách hàng được chỉnh sửa ở trang riêng." /><section className="admin-panel">{error && <div className="alert alert-danger">{error}</div>}<form className="admin-form-grid" onSubmit={submit}><label className="admin-field"><span>Họ và tên</span><input className="form-control" value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} required /></label><label className="admin-field"><span>Số điện thoại</span><input className="form-control" inputMode="tel" maxLength={12} value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: formatPhoneInput(e.target.value) }))} required /></label><label className="admin-field"><span>Email</span><input className="form-control" type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label><label className="admin-field admin-field--wide"><span>Ghi chú</span><textarea className="form-control" rows="4" maxLength="1000" value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} /></label><div className="admin-field admin-field--wide admin-crud-actions"><Link className="btn btn-outline-secondary" to={`/admin/khach-hang/${id}`}>Hủy</Link><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div></form></section></div>
}
export default AdminCustomerEditPage
