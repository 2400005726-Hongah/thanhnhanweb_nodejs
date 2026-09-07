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
import AdminTripSeatMap from '../../components/admin/AdminTripSeatMap.jsx'
import {
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  getTripSeatMap,
} from '../../services/admin.service.js'
import {
  getApiErrorMessage,
} from '../../services/apiClient.js'
import {
  getBusTypeLabel,
} from '../../utils/busTypes.js'
import {
  formatDateTime,
} from '../../utils/formatDateTime.js'
import {
  formatLicensePlate,
} from '../../utils/normalizers.js'

const TRIP_STATUS_LABELS = {
  OPEN: 'Đang mở bán',
  CLOSED: 'Đã đóng đặt vé',
  DEPARTED: 'Đã khởi hành',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
}

const getTripStatusStyle = (status) => {
  const colors = {
    OPEN: '#16864b',
    CLOSED: '#9a6700',
    DEPARTED: '#b45309',
    COMPLETED: '#64748b',
    CANCELLED: '#dc2626',
  }

  return {
    color: colors[status] || '#64748b',
    background: 'transparent',
    border: 0,
    boxShadow: 'none',
    padding: 0,
    margin: 0,
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  }
}

function AdminTripSeatsPage() {
  const { tripId } = useParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setData(
        await getTripSeatMap(tripId),
      )
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError),
      )
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return (
      <LoadingState label="Đang tải sơ đồ ghế chuyến xe..." />
    )
  }

  if (error && !data) {
    return (
      <ErrorState
        message={error}
        onRetry={load}
      />
    )
  }

  const trip = data.trip
  const summary = data.summary

  const licensePlate =
    trip.bus?.licensePlate
      ? formatLicensePlate(
          trip.bus.licensePlate,
        )
      : 'Chưa có biển số'

  const busType =
    getBusTypeLabel(
      trip.bus?.busType,
    )

  return (
    <>
      <AdminPageHeader
        actions={(
          <div className="d-flex gap-2">
            <Link
              className="btn btn-outline-secondary"
              to="/admin/chuyen-xe"
            >
              Quay lại
            </Link>

            <button
              className="btn btn-primary"
              disabled={loading}
              onClick={load}
              type="button"
            >
              {loading
                ? 'Đang làm mới...'
                : 'Làm mới'}
            </button>
          </div>
        )}
        description="Chỉ hiển thị trạng thái còn trống, đang giữ và đã đặt. Không thể chọn ghế tại trang này."
        title="Sơ đồ ghế chuyến xe"
      />

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span>THÔNG TIN CHUYẾN</span>

            <h2>
              {trip.route?.routeName ||
                'Chưa cập nhật tuyến'}
            </h2>
          </div>

          <span
            style={getTripStatusStyle(
              trip.status,
            )}
          >
            {TRIP_STATUS_LABELS[
              trip.status
            ] || 'Không xác định'}
          </span>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <span>Khởi hành</span>

            <strong>
              {formatDateTime(
                trip.departureTime,
              )}
            </strong>
          </div>

          <div className="admin-field">
            <span>Xe</span>

            <strong>
              {licensePlate}
            </strong>
          </div>

          <div className="admin-field">
            <span>Loại xe</span>

            <strong>
              {busType}
            </strong>
          </div>

          <div className="admin-field">
            <span>Sức chứa</span>

            <strong>
              {trip.bus?.capacity ||
                summary.total}{' '}
              vị trí
            </strong>
          </div>
        </div>
      </section>

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <span>Tổng vị trí</span>
          <strong>
            {summary.total}
          </strong>
        </article>

        <article className="admin-stat-card admin-stat-card--money">
          <span>Còn trống</span>
          <strong>
            {summary.available}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>Đang giữ</span>
          <strong>
            {summary.held}
          </strong>
        </article>

        <article className="admin-stat-card admin-stat-card--refund">
          <span>Đã đặt</span>
          <strong>
            {summary.booked}
          </strong>
        </article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span>SƠ ĐỒ GHẾ</span>

            <h2>
              Trạng thái ghế theo thời gian thực
            </h2>
          </div>

          <small>
            Ghế giữ hết hạn được tự động chuyển về còn trống.
          </small>
        </div>

        <AdminTripSeatMap
          busType={trip.bus?.busType}
          floors={data.floors}
        />
      </section>
    </>
  )
}

export default AdminTripSeatsPage