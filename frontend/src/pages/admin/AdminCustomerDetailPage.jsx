import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import {
  getCustomerDetail,
  updateCustomerStatus,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import {
  getAuditActionLabel,
  getRoleLabel,
  translateAuditDescription,
} from '../../utils/auditLabels.js'
import {
  hasPermission,
  PERMISSIONS,
} from '../../utils/adminPermissions.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import {
  formatBookingCode, formatLicensePlate, formatPhoneInput } from '../../utils/normalizers.js'
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../../utils/paymentLabels.js'

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã đặt',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  COMPLETED: 'Đã hoàn thành',
  NO_SHOW: 'Không đi',
  DELETED: 'Đã xóa',
}

const SOURCE_LABELS = {
  ONLINE: 'Trực tuyến',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}


const displayDateTime = (value) =>
  value ? formatDateTime(value) : '—'

const getStatusClass = (status) =>
  `status-badge status-badge--${String(
    status || 'inactive',
  ).toLowerCase()}`

function AdminCustomerDetailPage() {
  const { id: customerId } = useParams()
  const { user } = useAuth()

  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showLockForm, setShowLockForm] =
    useState(false)
  const [lockReason, setLockReason] =
    useState('')
  const [updatingStatus, setUpdatingStatus] =
    useState(false)

  const canManageStatus = hasPermission(
    user,
    PERMISSIONS.MANAGE_CUSTOMER_STATUS,
  )

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true)
      setError('')

      try {
        const result = await getCustomerDetail(
          customerId,
          {
            page: targetPage,
            limit: 20,
          },
        )

        setData(result)
      } catch (requestError) {
        setError(
          getApiErrorMessage(requestError),
        )
      } finally {
        setLoading(false)
      }
    },
    [customerId],
  )

  useEffect(() => {
    load(page)
  }, [load, page])

  const lockCustomer = async (event) => {
    event.preventDefault()

    const reason = lockReason.trim()

    if (
      reason.length < 5 ||
      reason.length > 500
    ) {
      setActionError(
        'Lý do khóa phải có từ 5 đến 500 ký tự.',
      )
      return
    }

    setUpdatingStatus(true)
    setActionError('')

    try {
      await updateCustomerStatus(
        customerId,
        'BLOCKED',
        reason,
      )

      setShowLockForm(false)
      setLockReason('')
      await load(page)
    } catch (requestError) {
      setActionError(
        getApiErrorMessage(requestError),
      )
    } finally {
      setUpdatingStatus(false)
    }
  }

  const unlockCustomer = async () => {
    const confirmed = window.confirm(
      'Bạn có chắc muốn mở khóa khách hàng này?',
    )

    if (!confirmed) {
      return
    }

    setUpdatingStatus(true)
    setActionError('')

    try {
      await updateCustomerStatus(
        customerId,
        'ACTIVE',
      )

      await load(page)
    } catch (requestError) {
      setActionError(
        getApiErrorMessage(requestError),
      )
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => load(page)}
      />
    )
  }

  if (loading && !data) {
    return <LoadingState />
  }

  if (!data?.customer) {
    return (
      <EmptyState message="Không tìm thấy khách hàng." />
    )
  }

  const {
    customer,
    statistics,
    bookings = [],
    auditLogs = [],
    pagination,
  } = data

  const violationCount =
    statistics?.violations?.count ??
    (
      Number(
        statistics?.cancelledBookings || 0,
      ) +
      Number(
        statistics?.noShowBookings || 0,
      )
    )

  return (
    <>
      <AdminPageHeader
        title="Chi tiết khách hàng"
        description={`Mã khách hàng: ${customer.id
          .slice(0, 8)
          .toUpperCase()}`}
        actions={
          <>
            <Link
              className="btn btn-outline-secondary"
              to="/admin/khach-hang"
            >
              ← Quay lại
            </Link>

            {canManageStatus &&
              customer.status === 'ACTIVE' && (
                <button
                  className="btn btn-danger"
                  disabled={updatingStatus}
                  onClick={() =>
                    setShowLockForm(true)
                  }
                  type="button"
                >
                  Khóa khách hàng
                </button>
              )}

            {canManageStatus &&
              customer.status === 'BLOCKED' && (
                <button
                  className="btn btn-success"
                  disabled={updatingStatus}
                  onClick={unlockCustomer}
                  type="button"
                >
                  {updatingStatus
                    ? 'Đang xử lý...'
                    : 'Mở khóa'}
                </button>
              )}
          </>
        }
      />

      {actionError && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {showLockForm &&
        canManageStatus &&
        customer.status === 'ACTIVE' && (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span>THAO TÁC QUẢN TRỊ</span>
                <h2>Khóa khách hàng</h2>
              </div>
            </div>

            <form onSubmit={lockCustomer}>
              <label className="admin-field">
                <span>Lý do khóa</span>

                <textarea
                  className="form-control"
                  maxLength={500}
                  onChange={(event) =>
                    setLockReason(
                      event.target.value,
                    )
                  }
                  placeholder="Nhập lý do khóa khách hàng..."
                  required
                  rows={4}
                  value={lockReason}
                />
              </label>

              <div className="admin-row-actions mt-3">
                <button
                  className="is-danger"
                  disabled={updatingStatus}
                  type="submit"
                >
                  {updatingStatus
                    ? 'Đang khóa...'
                    : 'Xác nhận khóa'}
                </button>

                <button
                  disabled={updatingStatus}
                  onClick={() => {
                    setShowLockForm(false)
                    setLockReason('')
                    setActionError('')
                  }}
                  type="button"
                >
                  Hủy
                </button>
              </div>
            </form>
          </section>
        )}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <span>Tổng số vé</span>
          <strong>
            {statistics?.totalBookings ?? 0}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>Vé hợp lệ</span>
          <strong>
            {statistics?.validBookings ?? 0}
          </strong>
        </article>

        <article className="admin-stat-card admin-stat-card--refund">
          <span>Đã hủy</span>
          <strong>
            {statistics?.cancelledBookings ?? 0}
          </strong>
        </article>

        <article className="admin-stat-card admin-stat-card--refund">
          <span>Không đi</span>
          <strong>
            {statistics?.noShowBookings ?? 0}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>Tổng vi phạm</span>
          <strong>{violationCount}</strong>
        </article>

        {statistics?.finance && (
          <article className="admin-stat-card admin-stat-card--money">
            <span>Tổng tiền đã thanh toán</span>
            <strong>
              {formatCurrency(
                statistics.finance.totalSpent,
              )}
            </strong>
          </article>
        )}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span>HỒ SƠ KHÁCH HÀNG</span>
            <h2>Thông tin chung</h2>
          </div>

          <span
            className={
              customer.status === 'BLOCKED'
                ? 'status-badge status-badge--cancelled'
                : 'status-badge status-badge--active'
            }
          >
            {customer.status === 'BLOCKED'
              ? 'Đã khóa'
              : 'Hoạt động'}
          </span>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <span>Họ và tên</span>
            <strong>{customer.fullName}</strong>
          </div>

          <div className="admin-field">
            <span>Số điện thoại</span>
            <strong>
              {customer.phone ? formatPhoneInput(customer.phone) : 'Chưa cập nhật'}
            </strong>
          </div>

          <div className="admin-field">
            <span>Email</span>
            <strong>
              {customer.email ||
                'Chưa cập nhật email'}
            </strong>
          </div>

          <div className="admin-field">
            <span>Ngày tạo hồ sơ</span>
            <strong>
              {displayDateTime(
                customer.createdAt,
              )}
            </strong>
          </div>

          <div className="admin-field">
            <span>Lần đặt vé gần nhất</span>
            <strong>
              {displayDateTime(
                statistics?.lastBookingAt,
              )}
            </strong>
          </div>

          <div className="admin-field">
            <span>Tuyến thường đi</span>
            <strong>
              {statistics?.favoriteRoute
                ? `${statistics.favoriteRoute.routeName} (${statistics.favoriteRoute.count} vé)`
                : 'Chưa xác định'}
            </strong>
          </div>

          {customer.blockedReason && (
            <div className="admin-field admin-field--wide">
              <span>Lý do khóa</span>
              <strong>
                {customer.blockedReason}
              </strong>

              <small>
                Khóa lúc:{' '}
                {displayDateTime(
                  customer.blockedAt,
                )}
              </small>

              {customer.blockedBy && (
                <small>
                  Người khóa:{' '}
                  {customer.blockedBy.fullName}
                </small>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span>LỊCH SỬ VÉ</span>
            <h2>Các vé của khách hàng</h2>
          </div>

          <small>
            {pagination?.total ?? bookings.length}{' '}
            vé
          </small>
        </div>

        {bookings.length === 0 ? (
          <EmptyState message="Khách hàng chưa có vé." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã vé</th>
                  <th>Nguồn đặt</th>
                  <th>Hành trình</th>
                  <th>Xuất bến</th>
                  <th>Xe</th>
                  <th>Ghế</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái vé</th>
                  <th>Thanh toán</th>
                  <th>Ngày đặt</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => {
                  const payment =
                    booking.payments?.[0]

                  const seats =
                    booking.items
                      ?.map(
                        (item) =>
                          item.seatCode,
                      )
                      .join(', ') || '—'

                  return (
                    <tr key={booking.id}>
                      <td>
                        <strong>
                          {formatBookingCode(booking.bookingCode)}
                        </strong>

                        {payment?.transactionCode && (
                          <small>
                            GD:{' '}
                            {
                              payment.transactionCode
                            }
                          </small>
                        )}
                      </td>

                      <td>
                        <span className="status-badge">
                          {SOURCE_LABELS[
                            booking.source
                          ] ||
                            booking.source ||
                            'Chưa xác định'}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {booking.trip?.route
                            ?.routeName ||
                            'Chưa có tuyến'}
                        </strong>
                      </td>

                      <td>
                        {displayDateTime(
                          booking.trip
                            ?.departureTime,
                        )}
                      </td>

                      <td>
                        <strong>
                          {booking.trip?.bus
                            ?.busName || '—'}
                        </strong>

                        <small>
                          {booking.trip?.bus?.licensePlate
                            ? formatLicensePlate(booking.trip.bus.licensePlate)
                            : '—'}
                        </small>
                      </td>

                      <td>
                        <strong>{seats}</strong>
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            booking.totalAmount,
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            booking.status,
                          )}
                        >
                          {BOOKING_STATUS_LABELS[
                            booking.status
                          ] ||
                            booking.status}
                        </span>

                        {booking.cancellationReason && (
                          <small>
                            Lý do hủy:{' '}
                            {
                              booking.cancellationReason
                            }
                          </small>
                        )}

                        {booking.noShowReason && (
                          <small>
                            Lý do không đi:{' '}
                            {
                              booking.noShowReason
                            }
                          </small>
                        )}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            booking.paymentStatus,
                          )}
                        >
                          {getPaymentStatusLabel(
                            booking.paymentStatus,
                          )}
                        </span>

                        <small>
                          {getPaymentMethodLabel(
                            payment?.paymentMethod,
                          )}
                        </small>
                      </td>

                      <td>
                        {displayDateTime(
                          booking.createdAt,
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination?.totalPages > 1 && (
          <div className="d-flex align-items-center justify-content-between mt-3">
            <button
              className="btn btn-outline-secondary"
              disabled={page <= 1}
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1),
                )
              }
              type="button"
            >
              Trang trước
            </button>

            <strong>
              Trang {pagination.page}/
              {pagination.totalPages}
            </strong>

            <button
              className="btn btn-outline-secondary"
              disabled={
                page >= pagination.totalPages
              }
              onClick={() =>
                setPage(
                  (current) => current + 1,
                )
              }
              type="button"
            >
              Trang sau
            </button>
          </div>
        )}
      </section>

      {auditLogs.length > 0 && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>NHẬT KÝ LIÊN QUAN</span>
              <h2>Lịch sử thao tác</h2>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Hành động</th>
                  <th>Người thực hiện</th>
                  <th>Nội dung</th>
                  <th>Lý do</th>
                </tr>
              </thead>

              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {displayDateTime(
                        log.createdAt,
                      )}
                    </td>

                    <td>
                      <strong>
                        {getAuditActionLabel( log.action,)}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {log.user?.fullName ||
                          'Hệ thống'}
                      </strong>

                      <small>
                    {getRoleLabel(log.role,)}
                       </small>
                    </td>

                    <td>
                  {translateAuditDescription(log.description,)}
                       </td>

                    <td>
                      {log.reason || '—'}
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

export default AdminCustomerDetailPage