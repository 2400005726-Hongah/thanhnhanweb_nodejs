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
import {
  getBusTypeLabel,
  getSeatTypeLabel,
  MANAGED_BUS_CAPACITIES,
} from '../../utils/busTypes.js'

function AdminBusesPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    busName: '',
    licensePlate: '',
    busType: 'SLEEPER_34',
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
    try {
      await createBus(form)
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
            <label className="admin-field"><span>Loại xe</span><select className="form-select" onChange={(event) => setForm((current) => ({ ...current, busType: event.target.value }))} value={form.busType}><option value="SLEEPER_34">Giường nằm 34 giường</option><option value="LIMOUSINE_22">Limousine 22 phòng</option></select></label>
            <label className="admin-field"><span>Sức chứa do máy chủ quy định</span><input className="form-control" readOnly type="number" value={MANAGED_BUS_CAPACITIES[form.busType]} /></label>
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
                    <td>{bus.licensePlate}</td><td>{getBusTypeLabel(bus.busType)}</td><td>{bus.capacity}</td>
                    <td>
                      {bus.seats?.length ? (
                        <details className="admin-seat-layout">
                          <summary>Xem {bus.seats.length} vị trí</summary>
                          {[1, 2].map((floor) => {
                            const seats = bus.seats.filter(
                              (seat) => seat.floor === floor,
                            )
                            return seats.length ? (
                              <div key={floor}>
                                <strong>Tầng {floor}</strong>
                                <div>
                                  {seats.map((seat) => (
                                    <span key={seat.id} title={getSeatTypeLabel(seat.seatType)}>
                                      {seat.seatCode}
                                      <small>{getSeatTypeLabel(seat.seatType)}</small>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null
                          })}
                        </details>
                      ) : 'Chưa có ghế'}
                    </td>
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
