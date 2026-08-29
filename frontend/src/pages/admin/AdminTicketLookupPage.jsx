import {
  useState,
} from 'react'
import { Link } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import BookingTicket from '../../components/admin/BookingTicket.jsx'
import {
  EmptyState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  lookupBookingForAdmin,
} from '../../services/admin.service.js'
import {
  getApiErrorMessage,
} from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import {
  formatDateTime,
} from '../../utils/formatDateTime.js'
import {
  formatBookingCode,
  formatLicensePlate,
  formatPhoneInput,
  normalizeTicketLookupIdentifier,
} from '../../utils/normalizers.js'
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
  value
    ? formatDateTime(value)
    : '—'

const displayLocation = (location) => {
  if (!location) {
    return 'Chưa cập nhật'
  }

  if (typeof location === 'string') {
    return location
  }

  return [
    location.name,
    location.address,
    location.province,
  ]
    .filter(Boolean)
    .join(', ') || 'Chưa cập nhật'
}

const getStatusClass = (status) => {
  if (
    [
      'CANCELLED',
      'NO_SHOW',
      'DELETED',
    ].includes(status)
  ) {
    return 'status-badge status-badge--cancelled'
  }

  if (
    [
      'PENDING',
      'EXPIRED',
    ].includes(status)
  ) {
    return 'status-badge status-badge--pending'
  }

  return 'status-badge status-badge--active'
}

function AdminTicketLookupPage() {
  const [bookingCode, setBookingCode] =
    useState('')

  const [booking, setBooking] =
    useState(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [searched, setSearched] =
    useState(false)

  const lookupTicket = async (event) => {
    event.preventDefault()

    const normalizedCode =
      normalizeTicketLookupIdentifier(bookingCode)

    if (!normalizedCode) {
      setError(
        'Vui lòng nhập mã vé hoặc mã giao dịch cần kiểm tra.',
      )
      return
    }

    setLoading(true)
    setError('')
    setBooking(null)
    setSearched(true)

    try {
      const result =
        await lookupBookingForAdmin(
          normalizedCode,
        )

      const data =
        result?.booking ??
        result

      setBooking(data)

      setBookingCode(
        data?.bookingCode
          ? formatBookingCode(data.bookingCode)
          : normalizedCode,
      )
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  const clearLookup = () => {
    setBookingCode('')
    setBooking(null)
    setError('')
    setSearched(false)
  }

  const printTicket = () => {
    window.requestAnimationFrame(
      () => {
        window.requestAnimationFrame(
          () => {
            window.print()
          },
        )
      },
    )
  }

  const payment =
    booking?.payments?.[0] ??
    booking?.payment ??
    null

  const items =
    booking?.items ??
    booking?.seats ??
    []

  const pickupPoint =
    booking?.pickupPoint ??
    booking?.pickupLocation ??
    booking?.pickupAddress ??
    booking?.trip?.route
      ?.departureLocation

  const dropoffPoint =
    booking?.dropoffPoint ??
    booking?.dropoffLocation ??
    booking?.dropoffAddress ??
    booking?.trip?.route
      ?.arrivalLocation

  return (
    <>
      <AdminPageHeader
        title="Kiểm tra vé"
        description="Tra cứu bằng mã vé hoặc mã giao dịch. Khu vực quản trị không yêu cầu số điện thoại."
      />

      <form
        className="admin-filter-bar"
        onSubmit={lookupTicket}
      >
        <input
          autoComplete="off"
          className="form-control"
          onChange={(event) =>
            setBookingCode(
              event.target.value,
            )
          }
          placeholder="Nhập mã vé #1211 hoặc mã giao dịch TN132321343"
          value={bookingCode}
        />

        <div className="d-flex gap-2">
          <button
            className="btn btn-primary"
            disabled={loading}
            type="submit"
          >
            {loading
              ? 'Đang kiểm tra...'
              : 'Kiểm tra vé'}
          </button>

          <button
            className="btn btn-outline-secondary"
            disabled={loading}
            onClick={clearLookup}
            type="button"
          >
            Xóa
          </button>
        </div>
      </form>

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        searched &&
        !booking &&
        !error && (
          <EmptyState message="Không tìm thấy vé phù hợp." />
        )
      )}

      {booking && (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Link
              className="btn btn-outline-primary"
              to={`/admin/ve-xe/${booking.bookingCode}`}
            >
              Xem chi tiết
            </Link>

            <button
              className="btn btn-primary"
              onClick={printTicket}
              type="button"
            >
              In vé
            </button>
          </div>

          <section className="admin-panel">
            <div className="admin-panel__heading">
              <div>
                <h2>
                  Kết quả kiểm tra vé
                </h2>

                <p>
                  Dữ liệu được lấy trực
                  tiếp từ hệ thống đặt vé.
                </p>
              </div>

              <strong>
                {formatBookingCode(booking.bookingCode)}
              </strong>
            </div>

            <div className="admin-stat-grid">
              <article className="admin-stat-card">
                <span>
                  Trạng thái vé
                </span>

                <strong>
                  {BOOKING_STATUS_LABELS[
                    booking.status
                  ] ||
                    booking.status ||
                    'Chưa xác định'}
                </strong>
              </article>

              <article className="admin-stat-card">
                <span>
                  Thanh toán
                </span>

                <strong>
                  {getPaymentStatusLabel(
                    booking.paymentStatus,
                  )}
                </strong>
              </article>

              <article className="admin-stat-card">
                <span>
                  Nguồn đặt
                </span>

                <strong>
                  {SOURCE_LABELS[
                    booking.source
                  ] ||
                    booking.source ||
                    'Chưa xác định'}
                </strong>
              </article>

              <article className="admin-stat-card">
                <span>
                  Tổng tiền
                </span>

                <strong>
                  {formatCurrency(
                    booking.totalAmount ??
                      0,
                  )}
                </strong>
              </article>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field">
                <span>
                  Mã vé
                </span>

                <strong>
                  {formatBookingCode(booking.bookingCode)}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Hành khách
                </span>

                <strong>
                  {booking.passengerFullName ||
                    'Chưa cập nhật'}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Số điện thoại
                </span>

                <strong>
                  {booking.passengerPhone
                    ? formatPhoneInput(booking.passengerPhone)
                    : 'Chưa cập nhật'}
                </strong>
              </div>

              <div className="admin-field">
                <span>Email</span>

                <strong>
                  {booking.passengerEmail ||
                    'Chưa cập nhật'}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Tuyến đường
                </span>

                <strong>
                  {booking.trip?.route
                    ?.routeName ||
                    'Chưa xác định'}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Ngày giờ xuất bến
                </span>

                <strong>
                  {displayDateTime(
                    booking.trip
                      ?.departureTime,
                  )}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Điểm đón
                </span>

                <strong>
                  {displayLocation(
                    pickupPoint,
                  )}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Điểm trả
                </span>

                <strong>
                  {displayLocation(
                    dropoffPoint,
                  )}
                </strong>
              </div>

              <div className="admin-field">
                <span>Xe</span>

                <strong>
                  {booking.trip?.bus
                    ?.busName ||
                    'Chưa cập nhật'}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Biển số
                </span>

                <strong>
                  {booking.trip?.bus?.licensePlate
                    ? formatLicensePlate(booking.trip.bus.licensePlate)
                    : 'Chưa cập nhật'}
                </strong>
              </div>

              <div className="admin-field">
                <span>Ghế</span>

                <strong>
                  {items
                    .map(
                      (item) =>
                        item.seatCode,
                    )
                    .filter(Boolean)
                    .join(', ') ||
                    'Chưa cập nhật'}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Ngày đặt vé
                </span>

                <strong>
                  {displayDateTime(
                    booking.createdAt,
                  )}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Phương thức thanh toán
                </span>

                <strong>
                  {getPaymentMethodLabel(
                    payment?.paymentMethod,
                  )}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Trạng thái thanh toán
                </span>

                <strong>
                  {getPaymentStatusLabel(
                    payment?.status ??
                      booking.paymentStatus,
                  )}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Mã giao dịch
                </span>

                <strong>
                  {payment?.transactionCode ||
                    'Chưa có'}
                </strong>
              </div>

              <div className="admin-field">
                <span>
                  Thanh toán lúc
                </span>

                <strong>
                  {displayDateTime(
                    payment?.paidAt,
                  )}
                </strong>
              </div>
            </div>

            {(booking.cancellationReason ||
              booking.noShowReason ||
              booking.customerNote ||
              booking.staffNote) && (
              <div className="admin-form-grid mt-3">
                {booking.cancellationReason && (
                  <div className="admin-field admin-field--wide">
                    <span>
                      Lý do hủy
                    </span>

                    <strong>
                      {
                        booking.cancellationReason
                      }
                    </strong>
                  </div>
                )}

                {booking.noShowReason && (
                  <div className="admin-field admin-field--wide">
                    <span>
                      Lý do không đi
                    </span>

                    <strong>
                      {
                        booking.noShowReason
                      }
                    </strong>
                  </div>
                )}

                {booking.customerNote && (
                  <div className="admin-field admin-field--wide">
                    <span>
                      Ghi chú khách hàng
                    </span>

                    <strong>
                      {
                        booking.customerNote
                      }
                    </strong>
                  </div>
                )}

                {booking.staffNote && (
                  <div className="admin-field admin-field--wide">
                    <span>
                      Ghi chú nhân viên
                    </span>

                    <strong>
                      {
                        booking.staffNote
                      }
                    </strong>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="admin-panel__heading">
              <div>
                <h2>
                  Trạng thái xác minh
                </h2>
              </div>
            </div>

            <p>
              Vé hiện có trạng thái:{' '}
              <span
                className={getStatusClass(
                  booking.status,
                )}
              >
                {BOOKING_STATUS_LABELS[
                  booking.status
                ] ||
                  booking.status ||
                  'Chưa xác định'}
              </span>
            </p>
          </section>

          <BookingTicket
            booking={booking}
          />
        </>
      )}
    </>
  )
}

export default AdminTicketLookupPage