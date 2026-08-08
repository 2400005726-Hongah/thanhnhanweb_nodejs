import { useCallback, useEffect, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
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
  formatLicensePlate,
  isVietnameseLicensePlate,
  normalizeLicensePlate,
  normalizeWhitespace,
} from '../../utils/normalizers.js'
import {
  getBusTypeLabel,
  getSeatTypeLabel,
  MANAGED_BUS_CAPACITIES,
} from '../../utils/busTypes.js'

const PAGE_SIZE = 30
const EMPTY_FORM = {
  busName: '',
  licensePlate: '',
  busType: 'SLEEPER_34',
}
const EMPTY_FILTERS = { keyword: '', status: '', busType: '' }
const STATUS_LABELS = {
  ACTIVE: 'Hoạt động',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng hoạt động',
}

const statusClass = (status) => {
  if (status === 'ACTIVE') return 'status-badge status-badge--active'
  if (status === 'MAINTENANCE') return 'status-badge status-badge--pending'
  return 'status-badge status-badge--inactive'
}

function AdminBusesPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, PERMISSIONS.MANAGE_BUSES)

  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editingBus, setEditingBus] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [processingBusId, setProcessingBusId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async (targetPage, targetFilters) => {
    setLoading(true)
    setError('')
    try {
      const result = await getBuses({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(targetFilters.keyword && { keyword: targetFilters.keyword }),
        ...(targetFilters.status && { status: targetFilters.status }),
        ...(targetFilters.busType && { busType: targetFilters.busType }),
      })
      setData(result)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, appliedFilters)
  }, [appliedFilters, load, page])

  const closeForm = () => {
    setShowForm(false)
    setEditingBus(null)
    setForm({ ...EMPTY_FORM })
  }

  const openCreateForm = () => {
    setEditingBus(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  const openEditForm = (bus) => {
    setEditingBus(bus)
    setForm({
      busName: bus.busName || '',
      licensePlate: formatLicensePlate(bus.licensePlate || ''),
      busType: bus.busType,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const changeForm = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]:
        name === 'licensePlate' ? formatLicensePlate(value) : value,
    }))
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const busName = normalizeWhitespace(form.busName)
    const licensePlate = normalizeLicensePlate(form.licensePlate)

    if (busName.length < 2) {
      window.alert('Tên xe phải có ít nhất 2 ký tự.')
      return
    }
    if (!isVietnameseLicensePlate(licensePlate)) {
      window.alert('Biển số xe phải đúng định dạng XXY-XXX.XX, ví dụ 47B-123.45.')
      return
    }

    setSubmitting(true)
    try {
      if (editingBus) {
        await updateBus(editingBus.id, { busName, licensePlate })
      } else {
        await createBus({ busName, licensePlate, busType: form.busType })
      }
      closeForm()
      if (page === 1) await load(1, appliedFilters)
      else setPage(1)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  const changeStatus = async (bus, nextStatus) => {
    const confirmed = window.confirm(
      `Chuyển xe "${bus.busName}" sang trạng thái "${STATUS_LABELS[nextStatus]}"?`,
    )
    if (!confirmed) return

    setProcessingBusId(bus.id)
    try {
      await updateBus(bus.id, { status: nextStatus })
      await load(page, appliedFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingBusId('')
    }
  }

  const deactivate = async (bus) => {
    const confirmed = window.confirm(
      `Ngừng hoạt động xe "${bus.busName}"?\n\nXe vẫn được giữ trong lịch sử nhưng không thể dùng để tạo chuyến mới.`,
    )
    if (!confirmed) return

    setProcessingBusId(bus.id)
    try {
      await deleteBus(bus.id)
      await load(page, appliedFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingBusId('')
    }
  }

  const submitFilters = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({
      keyword: filters.keyword.trim(),
      status: filters.status,
      busType: filters.busType,
    })
  }

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS })
    setAppliedFilters({ ...EMPTY_FILTERS })
    setPage(1)
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => load(page, appliedFilters)} />
  }
  if (loading && !data) return <LoadingState />

  const buses = data?.buses ?? []
  const pagination = data?.pagination ?? {
    page,
    total: buses.length,
    totalPages: 1,
  }

  return (
    <>
      <AdminPageHeader
        title="Quản lý xe"
        description={
          canManage
            ? 'Quản lý xe, trạng thái hoạt động và sơ đồ ghế.'
            : 'Nhân viên chỉ được xem xe và sơ đồ ghế.'
        }
        actions={
          canManage && (
            <button className="btn btn-primary" onClick={openCreateForm} type="button">
              + Thêm xe
            </button>
          )
        }
      />

      {error && <div className="alert alert-danger">{error}</div>}

      {canManage && showForm && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>QUẢN LÝ XE</span>
              <h2>{editingBus ? 'Sửa thông tin xe' : 'Thêm xe và tạo ghế tự động'}</h2>
            </div>
          </div>

          <form className="admin-form-grid" onSubmit={submitForm}>
            <label className="admin-field">
              <span>Tên xe</span>
              <input
                className="form-control"
                maxLength={100}
                name="busName"
                onChange={changeForm}
                placeholder="Ví dụ: Thành Nhân 01"
                required
                value={form.busName}
              />
            </label>

            <label className="admin-field">
              <span>Biển số xe</span>
              <input
                className="form-control"
                maxLength={10}
                name="licensePlate"
                onChange={changeForm}
                placeholder="Ví dụ: 47B-123.45"
                required
                value={form.licensePlate}
                inputMode="text"
              />
              <small>Định dạng bắt buộc: XXY-XXX.XX. Hệ thống tự thêm dấu.</small>
            </label>

            <label className="admin-field">
              <span>Loại xe</span>
              {editingBus ? (
                <input
                  className="form-control"
                  readOnly
                  value={getBusTypeLabel(form.busType)}
                />
              ) : (
                <select
                  className="form-select"
                  name="busType"
                  onChange={changeForm}
                  value={form.busType}
                >
                  <option value="SLEEPER_34">Giường nằm 34 giường</option>
                  <option value="LIMOUSINE_22">Limousine 22 phòng</option>
                </select>
              )}
            </label>

            <label className="admin-field">
              <span>Sức chứa</span>
              <input
                className="form-control"
                readOnly
                type="number"
                value={MANAGED_BUS_CAPACITIES[form.busType] || ''}
              />
              <small>Loại xe và sơ đồ ghế không được đổi sau khi tạo.</small>
            </label>

            <div className="admin-field admin-field--wide d-flex gap-2">
              <button className="btn btn-primary" disabled={submitting} type="submit">
                {submitting
                  ? 'Đang lưu...'
                  : editingBus
                    ? 'Lưu thay đổi'
                    : 'Tạo xe và ghế tự động'}
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={submitting}
                onClick={closeForm}
                type="button"
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      <form className="admin-filter-bar" onSubmit={submitFilters}>
        <input
          className="form-control"
          name="keyword"
          onChange={(event) =>
            setFilters((current) => ({ ...current, keyword: event.target.value }))
          }
          placeholder="Tìm theo tên xe hoặc biển số..."
          value={filters.keyword}
        />
        <select
          className="form-select"
          name="busType"
          onChange={(event) =>
            setFilters((current) => ({ ...current, busType: event.target.value }))
          }
          value={filters.busType}
        >
          <option value="">Tất cả loại xe</option>
          <option value="SLEEPER_34">Giường nằm 34 giường</option>
          <option value="LIMOUSINE_22">Limousine 22 phòng</option>
        </select>
        <select
          className="form-select"
          name="status"
          onChange={(event) =>
            setFilters((current) => ({ ...current, status: event.target.value }))
          }
          value={filters.status}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="MAINTENANCE">Bảo trì</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" type="submit">Tìm kiếm</button>
          <button className="btn btn-outline-secondary" onClick={clearFilters} type="button">
            Xóa lọc
          </button>
        </div>
      </form>

      {buses.length === 0 ? (
        <EmptyState message="Không tìm thấy xe phù hợp." />
      ) : (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><span>DANH SÁCH XE</span><h2>Xe đang quản lý</h2></div>
            <small>{buses.length}/{pagination.total ?? buses.length} xe</small>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>STT</th><th>Xe</th><th>Biển số</th><th>Loại xe</th>
                  <th>Sức chứa</th><th>Sơ đồ ghế</th><th>Trạng thái</th>
                  {canManage && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {buses.map((bus, index) => {
                  const processing = processingBusId === bus.id
                  return (
                    <tr key={bus.id}>
                      <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                      <td><strong>{bus.busName}</strong></td>
                      <td><strong>{formatLicensePlate(bus.licensePlate)}</strong></td>
                      <td>{getBusTypeLabel(bus.busType)}</td>
                      <td>{bus.capacity} vị trí</td>
                      <td>
                        {bus.seats?.length ? (
                          <details className="admin-seat-layout">
                            <summary>Xem {bus.seats.length} vị trí</summary>
                            {[1, 2].map((floor) => {
                              const seats = bus.seats.filter((seat) => seat.floor === floor)
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
                      <td><span className={statusClass(bus.status)}>{STATUS_LABELS[bus.status] || 'Không xác định'}</span></td>
                      {canManage && (
                        <td>
                          <div className="admin-row-actions">
                            <button disabled={processing} onClick={() => openEditForm(bus)} type="button">Sửa</button>
                            {bus.status === 'ACTIVE' && (
                              <button disabled={processing} onClick={() => changeStatus(bus, 'MAINTENANCE')} type="button">Bảo trì</button>
                            )}
                            {bus.status === 'MAINTENANCE' && (
                              <button disabled={processing} onClick={() => changeStatus(bus, 'ACTIVE')} type="button">Hoạt động lại</button>
                            )}
                            {bus.status !== 'INACTIVE' ? (
                              <button className="is-danger" disabled={processing} onClick={() => deactivate(bus)} type="button">Ngừng hoạt động</button>
                            ) : (
                              <button disabled={processing} onClick={() => changeStatus(bus, 'ACTIVE')} type="button">Khôi phục</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <button className="btn btn-outline-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Trang trước</button>
              <strong>Trang {pagination.page ?? page}/{pagination.totalPages}</strong>
              <button className="btn btn-outline-secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Trang sau</button>
            </div>
          )}
        </section>
      )}
    </>
  )
}

export default AdminBusesPage
