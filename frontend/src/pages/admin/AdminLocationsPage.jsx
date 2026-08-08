import { useCallback, useEffect, useState } from 'react'
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { createLocation, deleteLocation, getLocations, updateLocation } from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import {
  normalizeAddress,
  normalizeLocationName,
  normalizeProvince,
} from '../../utils/normalizers.js'

const EMPTY = { name: '', province: '', address: '' }

function AdminLocationsPage() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await getLocations({ page: 1, limit: 100 }))
      setError('')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    try {
      const payload = {
        name: normalizeLocationName(form.name),
        province: normalizeProvince(form.province),
        address: normalizeAddress(form.address),
      }
      if (editing) await updateLocation(editing.id, payload)
      else await createLocation(payload)
      setEditing(null)
      setForm(EMPTY)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const edit = (item) => {
    setEditing(item)
    setForm({ name: item.name || '', province: item.province || '', address: item.address || '' })
  }

  const deactivate = async (item) => {
    if (!window.confirm(`Ngừng hoạt động địa điểm "${item.name}"?`)) return
    try {
      await deleteLocation(item.id)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const restore = async (item) => {
    try {
      await updateLocation(item.id, { status: 'ACTIVE' })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  return (
    <>
      <AdminPageHeader title="Quản lý địa điểm" description="Quản lý tỉnh/thành và điểm dùng để tạo tuyến xe." />
      {error && <div className="alert alert-danger">{error}</div>}
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span>ĐỊA ĐIỂM</span><h2>{editing ? 'Sửa địa điểm' : 'Thêm địa điểm'}</h2></div></div>
        <form className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field"><span>Tên địa điểm</span><input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={(e) => setForm({ ...form, name: normalizeLocationName(e.target.value) })} placeholder="Ví dụ: Buôn Ma Thuột" /></label>
          <label className="admin-field"><span>Tỉnh/Thành</span><select className="form-select" required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}><option value="">Chọn tỉnh/thành</option><option value="Đắk Lắk">Đắk Lắk</option><option value="TP.HCM">TP.HCM</option><option value="Bình Dương">Bình Dương</option></select></label>
          <label className="admin-field admin-field--wide"><span>Địa chỉ chi tiết</span><input className="form-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} onBlur={(e) => setForm({ ...form, address: normalizeAddress(e.target.value) })} /></label>
          <div className="admin-field admin-field--wide d-flex gap-2"><button className="btn btn-primary" type="submit">{editing ? 'Lưu thay đổi' : 'Thêm địa điểm'}</button>{editing && <button className="btn btn-outline-secondary" type="button" onClick={() => { setEditing(null); setForm(EMPTY) }}>Hủy</button>}</div>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>STT</th><th>Địa điểm</th><th>Tỉnh/Thành</th><th>Địa chỉ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {(data?.locations || []).map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.name}</td><td>{item.province}</td><td>{item.address || '—'}</td><td>{item.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}</td><td><div className="admin-row-actions"><button type="button" onClick={() => edit(item)}>Sửa</button>{item.status === 'ACTIVE' ? <button className="is-danger" type="button" onClick={() => deactivate(item)}>Ngừng hoạt động</button> : <button type="button" onClick={() => restore(item)}>Khôi phục</button>}</div></td></tr>)}
        </tbody></table></div>
      </section>
    </>
  )
}

export default AdminLocationsPage
