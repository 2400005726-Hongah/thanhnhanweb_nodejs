import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { createBus, getBuses, updateBus } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getBusTypeLabel, MANAGED_BUS_CAPACITIES } from '../../utils/busTypes.js'
import { formatLicensePlate, isVietnameseLicensePlate, normalizeLicensePlate } from '../../utils/normalizers.js'

const EMPTY_FORM = { licensePlate: '', busType: 'SLEEPER_34', status: 'ACTIVE' }

function AdminBusFormPage({ mode = 'create' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = mode === 'edit'
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [bus, setBus] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!editing) return
    setLoading(true); setError('')
    try {
      const result = await getBuses({ page: 1, limit: 100 })
      const found = (result?.buses ?? []).find((item) => item.id === id)
      if (!found) throw new Error('Không tìm thấy xe cần sửa.')
      setBus(found)
      setForm({ licensePlate: formatLicensePlate(found.licensePlate || ''), busType: found.busType, status: found.status || 'ACTIVE' })
    } catch (requestError) { setError(getApiErrorMessage(requestError)) }
    finally { setLoading(false) }
  }, [editing, id])
  useEffect(() => { load() }, [load])

  const change = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: name === 'licensePlate' ? formatLicensePlate(value) : value }))
  }
  const submit = async (event) => {
    event.preventDefault()
    const licensePlate = normalizeLicensePlate(form.licensePlate)
    if (!isVietnameseLicensePlate(licensePlate)) return setError('Biển số xe phải đúng định dạng XXY-XXX.XX, ví dụ 47B-123.45.')
    setSaving(true); setError('')
    try {
      if (editing) await updateBus(id, { licensePlate, status: form.status })
      else await createBus({ licensePlate, busType: form.busType, status: form.status })
      navigate('/admin/xe', { replace: true })
    } catch (requestError) { setError(getApiErrorMessage(requestError)) }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingState />
  if (error && editing && !bus) return <ErrorState message={error} onRetry={load} />

  return <div className="admin-crud-page">
    <AdminPageHeader title={editing ? 'Sửa xe' : 'Thêm xe'} description={editing ? 'Cập nhật biển số và trạng thái. Loại xe/sơ đồ ghế được giữ nguyên sau khi tạo.' : 'Tạo xe mới và sinh sơ đồ ghế/phòng tự động.'} />
    <section className="admin-panel">
      {error && <div className="alert alert-danger">{error}</div>}
      <form className="admin-form-grid" onSubmit={submit}>
        <label className="admin-field"><span>Biển số xe</span><input className="form-control" maxLength={10} name="licensePlate" onChange={change} placeholder="47B-123.45" required value={form.licensePlate} /></label>
        <label className="admin-field"><span>Loại xe</span>{editing ? <input className="form-control" readOnly value={getBusTypeLabel(form.busType)} /> : <select className="form-select" name="busType" onChange={change} value={form.busType}><option value="SLEEPER_34">Giường nằm 34 giường</option><option value="LIMOUSINE_22">Limousine 22 phòng</option></select>}</label>
        <label className="admin-field"><span>Số ghế/phòng</span><input className="form-control" readOnly value={MANAGED_BUS_CAPACITIES[form.busType] || ''} /></label>
        <label className="admin-field"><span>Trạng thái</span><select className="form-select" name="status" onChange={change} value={form.status}><option value="ACTIVE">Hoạt động</option><option value="MAINTENANCE">Bảo trì</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>
        <div className="admin-field admin-field--wide admin-crud-actions"><Link className="btn btn-outline-secondary" to="/admin/xe">Hủy</Link><button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm xe'}</button></div>
      </form>
    </section>
  </div>
}
export default AdminBusFormPage
