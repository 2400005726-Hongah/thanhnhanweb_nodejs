import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  getCustomers,
  updateCustomer,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import {
  formatPhoneInput,
  isValidFullName,
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from '../../utils/normalizers.js'

const getCustomerStatusLabel = (status) => {
  if (status === 'BLOCKED') return 'Đã khóa'
  return 'Hoạt động'
}

const getViolationLabel = (violations) => {
  if (violations?.level === 'BLOCKED') return 'Rủi ro cao'
  if (violations?.level === 'WARNING') return 'Cảnh báo'
  return 'Bình thường'
}

const getViolationClass = (violations) => {
  if (violations?.level === 'BLOCKED') {
    return 'status-badge status-badge--cancelled'
  }

  if (violations?.level === 'WARNING') {
    return 'status-badge status-badge--pending'
  }

  return 'status-badge status-badge--active'
}

function AdminCustomersPage() {
  const [data, setData] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (
    searchKeyword = '',
    selectedStatus = '',
  ) => {
    setError('')

    try {
      const result = await getCustomers({
        page: 1,
        limit: 100,
        ...(searchKeyword.trim() && {
          keyword: searchKeyword.trim(),
        }),
        ...(selectedStatus && {
          status: selectedStatus,
        }),
      })

      setData(result)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const customers = useMemo(
  () => data?.customers ?? [],
  [data?.customers],
)

  const summary = useMemo(() => {
    const active = customers.filter(
      (customer) => customer.status === 'ACTIVE',
    ).length

    const blocked = customers.filter(
      (customer) => customer.status === 'BLOCKED',
    ).length

    const warning = customers.filter(
      (customer) => customer.violations?.warning,
    ).length

    return {
      total: data?.pagination?.total ?? customers.length,
      active,
      blocked,
      warning,
    }
  }, [
  customers,
  data?.pagination?.total,
])

  const submitFilter = (event) => {
    event.preventDefault()
    load(keyword, status)
  }

  const clearFilter = () => {
    setKeyword('')
    setStatus('')
    load('', '')
  }

  const openEdit = (customer) => {
    setEditingCustomer({
      id: customer.id,
      fullName: customer.fullName ?? '',
      phone: formatPhoneInput(customer.phone ?? ''),
      email: customer.email ?? '',
    })
  }

  const closeEdit = () => {
    if (!saving) {
      setEditingCustomer(null)
    }
  }

  const changeEditField = (event) => {
    const { name, value } = event.target

    setEditingCustomer((current) => ({
      ...current,
      [name]: name === 'phone' ? formatPhoneInput(value) : value,
    }))
  }

  const saveCustomer = async (event) => {
    event.preventDefault()

    const fullName = normalizeFullName(editingCustomer.fullName)
    const phone = normalizePhone(editingCustomer.phone)
    const email = normalizeEmail(editingCustomer.email)

    if (!isValidFullName(fullName)) {
      window.alert('Họ tên phải có từ 2 đến 100 ký tự và không chứa ký tự không hợp lệ.')
      return
    }

    if (!isVietnamesePhone(phone)) {
      window.alert('Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0912 345 678.')
      return
    }

    setSaving(true)

    try {
      await updateCustomer(editingCustomer.id, {
        fullName,
        phone,
        email,
      })

      setEditingCustomer(null)
      await load(keyword, status)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Khách hàng"
        description="Hồ sơ được tổng hợp theo số điện thoại của các vé Trực tuyến, Hotline và Tại quầy."
      />

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <span>Tổng khách hàng</span>
          <strong>{summary.total}</strong>
        </article>

        <article className="admin-stat-card">
          <span>Đang hoạt động</span>
          <strong>{summary.active}</strong>
        </article>

        <article className="admin-stat-card admin-stat-card--refund">
          <span>Đã khóa</span>
          <strong>{summary.blocked}</strong>
        </article>

        <article className="admin-stat-card">
          <span>Khách cần cảnh báo</span>
          <strong>{summary.warning}</strong>
        </article>
      </div>

      <form
        className="admin-filter-bar"
        onSubmit={submitFilter}
      >
        <input
          className="form-control"
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tìm theo mã, tên, email hoặc số điện thoại"
          value={keyword}
        />

        <select
          className="form-select"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="BLOCKED">Đã khóa</option>
        </select>

        <div className="d-flex gap-2">
          <button
            className="btn btn-primary"
            type="submit"
          >
            Lọc dữ liệu
          </button>

          <button
            className="btn btn-outline-secondary"
            onClick={clearFilter}
            type="button"
          >
            Xóa lọc
          </button>
        </div>
      </form>

      {editingCustomer && (
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Sửa thông tin khách hàng</h2>
              <p>
                Cập nhật thông tin liên hệ cho hồ sơ khách hàng.
              </p>
            </div>
          </div>

          <form
            className="admin-form-grid"
            onSubmit={saveCustomer}
          >
            <label>
              Họ và tên
              <input
                className="form-control"
                name="fullName"
                onBlur={(event) =>
                  setEditingCustomer((current) => ({
                    ...current,
                    fullName: normalizeFullName(event.target.value),
                  }))
                }
                onChange={changeEditField}
                required
                value={editingCustomer.fullName}
              />
            </label>

            <label>
              Số điện thoại
              <input
                className="form-control"
                inputMode="tel"
                maxLength={12}
                name="phone"
                onChange={changeEditField}
                placeholder="0912 345 678"
                required
                value={editingCustomer.phone}
              />
            </label>

            <label>
              Email
              <input
                className="form-control"
                name="email"
                onBlur={(event) =>
                  setEditingCustomer((current) => ({
                    ...current,
                    email: normalizeEmail(event.target.value),
                  }))
                }
                onChange={changeEditField}
                type="email"
                value={editingCustomer.email}
              />
            </label>

            <div className="admin-row-actions">
              <button
                className="btn btn-primary"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>

              <button
                className="btn btn-outline-secondary"
                disabled={saving}
                onClick={closeEdit}
                type="button"
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => load(keyword, status)}
        />
      ) : !data ? (
        <LoadingState />
      ) : customers.length === 0 ? (
        <EmptyState message="Chưa có khách hàng phù hợp." />
      ) : (
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Danh sách khách hàng</h2>
              <p>
                Khách trùng số điện thoại được tổng hợp chung thành một hồ sơ.
              </p>
            </div>

            <strong>
              {data.pagination?.total ?? customers.length} kết quả
            </strong>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã KH</th>
                  <th>Khách hàng</th>
                  <th>Liên hệ</th>
                  <th>Số vé</th>
                  <th>Vi phạm</th>
                  <th>Mức rủi ro</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>
                        {customer.id.slice(0, 8).toUpperCase()}
                      </strong>
                    </td>

                    <td>
                      <strong>{customer.fullName}</strong>

                      {customer.blockedReason && (
                        <small>
                          Lý do khóa: {customer.blockedReason}
                        </small>
                      )}
                    </td>

                    <td>
                      <strong>
                        {customer.phone ? formatPhoneInput(customer.phone) : 'Chưa cập nhật'}
                      </strong>

                      <small>
                        {customer.email || 'Chưa cập nhật email'}
                      </small>
                    </td>

                    <td>
                      <strong>{customer.totalBookings ?? 0}</strong>
                    </td>

                    <td>
                      <strong>{customer.violations?.count ?? 0}</strong>
                    </td>

                    <td>
                      <span className={getViolationClass(customer.violations)}>
                        {getViolationLabel(customer.violations)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          customer.status === 'BLOCKED'
                            ? 'status-badge status-badge--cancelled'
                            : 'status-badge status-badge--active'
                        }
                      >
                        {getCustomerStatusLabel(customer.status)}
                      </span>
                    </td>

                    <td>
                      {formatDateTime(customer.createdAt)}
                    </td>

                    <td>
                      <div className="admin-row-actions">
                        <button
                          onClick={() => openEdit(customer)}
                          type="button"
                        >
                          Sửa
                        </button>

                        <Link
                            to={`/admin/khach-hang/${customer.id}`}
                               >
                              Chi tiết
                          </Link>
                      </div>
                    </td>
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

export default AdminCustomersPage