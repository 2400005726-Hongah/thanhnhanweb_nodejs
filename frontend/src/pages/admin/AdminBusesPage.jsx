import { useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import {
  createBus,
  deleteBus,
  getBuses,
  updateBus,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'

function AdminBusesPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    busName: '',
    licensePlate: '',
    busType: 'SLEEPER',
    capacity: 44,
  })
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      setData(await getBuses({ page: 1, limit: 100 }))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <LoadingState />

  const canManage = hasPermission(user, PERMISSIONS.MANAGE_BUSES)

  const submit = async (event) => {
    event.preventDefault()
    const capacity = Number(form.capacity)
    const seats = Array.from({ length: capacity }, (_, index) => ({
      seatCode: `${form.busType === 'LIMOUSINE' ? 'V' : 'A'}${String(index + 1).padStart(2, '0')}`,
      floor:
        form.busType === 'SLEEPER' && index >= Math.ceil(capacity / 2)
          ? 2
          : 1,
      seatType: form.busType === 'LIMOUSINE' ? 'VIP' : 'NORMAL',
    }))
    try {
      await createBus({ ...form, capacity, seats })
      setShowForm(false)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const edit = async (bus) => {
    const busName = window.prompt('Tên xe:', bus.busName)
    if (!busName?.trim()) return
    try {
      await updateBus(bus.id, { busName })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  const remove = async (bus) => {
    if (!window.confirm(`Xóa mềm xe ${bus.busName}?`)) return
    try {
      await deleteBus(bus.id)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Quản lý xe"
        description={canManage ? 'Quản lý xe và cấu trúc ghế.' : 'Nhân viên chỉ được xem xe và sơ đồ ghế.'}
        actions={canManage && <button className="btn btn-primary" onClick={() => setShowForm((value) => !value)} type="button">+ Thêm xe</button>}
      />
      {canManage && showForm && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>CHỈ CHỦ XE</span><h2>Thêm xe và sơ đồ ghế</h2></div></div>
          <form className="admin-form-grid" onSubmit={submit}>
            <label className="admin-field"><span>Tên xe</span><input className="form-control" onChange={(event) => setForm((current) => ({ ...current, busName: event.target.value }))} required value={form.busName} /></label>
            <label className="admin-field"><span>Biển số</span><input className="form-control" onChange={(event) => setForm((current) => ({ ...current, licensePlate: event.target.value }))} required value={form.licensePlate} /></label>
            <label className="admin-field"><span>Loại xe</span><select className="form-select" onChange={(event) => setForm((current) => ({ ...current, busType: event.target.value }))} value={form.busType}><option value="SEATED">Ghế ngồi</option><option value="SLEEPER">Giường nằm</option><option value="LIMOUSINE">Limousine</option></select></label>
            <label className="admin-field"><span>Sức chứa</span><input className="form-control" min="1" onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} required type="number" value={form.capacity} /></label>
            <div className="admin-field admin-field--wide"><button className="btn btn-primary" type="submit">Tạo xe và ghế tự động</button></div>
          </form>
        </section>
      )}
      {data.buses.length === 0 ? (
        <EmptyState message="Chưa có xe." />
      ) : (
        <section className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Xe</th><th>Biển số</th><th>Loại xe</th><th>Sức chứa</th><th>Sơ đồ ghế</th><th>Trạng thái</th>{canManage && <th>Thao tác</th>}</tr></thead>
              <tbody>
                {data.buses.map((bus) => (
                  <tr key={bus.id}>
                    <td><strong>{bus.busName}</strong></td>
                    <td>{bus.licensePlate}</td><td>{bus.busType}</td><td>{bus.capacity}</td>
                    <td>{bus.seats?.map((seat) => seat.seatCode).join(', ') || 'Chưa có ghế'}</td>
                    <td><span className={`status-badge status-badge--${bus.status.toLowerCase()}`}>{bus.status}</span></td>
                    {canManage && <td><div className="admin-row-actions"><button onClick={() => edit(bus)} type="button">Sửa</button><button className="is-danger" onClick={() => remove(bus)} type="button">Xóa</button></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default AdminBusesPage
