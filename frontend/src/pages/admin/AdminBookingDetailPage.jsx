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
import { useAuth } from '../../contexts/authContext.js'
import BookingTicket from '../../components/admin/BookingTicket.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  cancelBooking,
  collectBookingPayment,
  deleteBooking,
  getBookingDetail,
  markNoShow,
  resendBookingEmail,
  undoBookingPayment,
  updateBookingContact,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getBusTypeLabel, getSeatTypeLabel } from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import {
  formatBookingCode,
  formatLicensePlate,
  formatPhoneInput,
  isValidFullName,
  isVietnamesePhone,
  normalizeFullName,
  normalizePhone,
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
  value ? formatDateTime(value) : '—'

const displayLocation = (
  location,
) => {
  if (!location) {
    return 'Chưa cập nhật'
  }

  if (
    typeof location === 'string'
  ) {
    return location
  }

  return [
    location.name,
    location.address,
    location.province,
  ]
    .filter(Boolean)
    .join(', ') ||
    'Chưa cập nhật'
}

function AdminBookingDetailPage() {
  const { bookingCode } =
    useParams()
  const { user } = useAuth()

  const [booking, setBooking] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [editing, setEditing] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [processing, setProcessing] =
    useState(false)

  const [currentTime, setCurrentTime] =
    useState(() => new Date())

  const [form, setForm] =
    useState({
      passengerFullName: '',
      passengerPhone: '',
      staffNote: '',
    })

  const load = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const result =
          await getBookingDetail(
            bookingCode,
          )

        const data =
          result?.booking ??
          result

        setBooking(data)

        setForm({
          passengerFullName:
            data
              ?.passengerFullName ??
            '',

          passengerPhone:
            formatPhoneInput(
              data?.passengerPhone ?? '',
            ),

          staffNote:
            data?.staffNote ?? '',
        })
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
          ),
        )
      } finally {
        setLoading(false)
      }
    },
    [bookingCode],
  )

  useEffect(() => {
    load()
  }, [load])


  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [])

  const changeField = (event) => {
    const {
      name,
      value,
    } = event.target

    setForm((current) => ({
      ...current,
      [name]:
        name === 'passengerPhone'
          ? formatPhoneInput(value)
          : value,
    }))
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

  const saveContact = async (
    event,
  ) => {
    event.preventDefault()

    const departureAt = booking?.trip?.departureTime
      ? new Date(booking.trip.departureTime)
      : null
    const tripStatus = booking?.trip?.status
    const tripHasDeparted = ['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(tripStatus)

    if (
      booking?.status !== 'CONFIRMED' ||
      !departureAt ||
      departureAt.getTime() <= Date.now() ||
      tripHasDeparted
    ) {
      setEditing(false)
      window.alert('Chuyến đã khởi hành. Vé không còn được phép sửa.')
      return
    }

    const passengerFullName =
      normalizeFullName(form.passengerFullName)

    const passengerPhone =
      normalizePhone(form.passengerPhone)

    if (!isValidFullName(passengerFullName)) {
      window.alert(
        'Họ tên hành khách không hợp lệ.',
      )
      return
    }

    if (!isVietnamesePhone(passengerPhone)) {
      window.alert(
        'Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0912 345 678.',
      )
      return
    }

    setSaving(true)

    try {
      await updateBookingContact(
        bookingCode,
        {
          passengerFullName,
          passengerPhone,
          staffNote: form.staffNote.trim(),
        },
      )

      setEditing(false)
      await load()
    } catch (requestError) {
      window.alert(
        getApiErrorMessage(
          requestError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }


  const resendEmail = async () => {
    if (!booking?.passengerEmail) {
      window.alert('Vé chưa có địa chỉ email để gửi.')
      return
    }

    setProcessing(true)
    try {
      await resendBookingEmail(bookingCode)
      window.alert('Đã gửi lại email vé điện tử.')
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessing(false)
    }
  }

  const cancelCurrentBooking =
    async () => {
      const reason = window.prompt(
        `Nhập lý do hủy vé ${booking.bookingCode}:`,
      )

      if (
        !reason ||
        reason.trim().length < 5 ||
        reason.trim().length > 500
      ) {
        window.alert(
          'Lý do hủy vé phải có từ 5 đến 500 ký tự.',
        )
        return
      }

      const confirmed =
        window.confirm(
          'Bạn có chắc muốn hủy vé này? Nếu vé đã thanh toán, hệ thống sẽ hoàn 100%.',
        )

      if (!confirmed) {
        return
      }

      setProcessing(true)

      try {
        await cancelBooking(
          booking.bookingCode,
          reason.trim(),
        )

        setEditing(false)
        await load()
      } catch (requestError) {
        window.alert(
          getApiErrorMessage(
            requestError,
          ),
        )
      } finally {
        setProcessing(false)
      }
    }

  const deleteCurrentBooking =
    async () => {
      const reason = window.prompt(
        `Nhập lý do xóa vé ${booking.bookingCode}:`,
      )

      if (
        !reason ||
        reason.trim().length < 5 ||
        reason.trim().length > 500
      ) {
        window.alert(
          'Lý do xóa vé phải có từ 5 đến 500 ký tự.',
        )
        return
      }

      const confirmed =
        window.confirm(
          'Xóa mềm vé này và giải phóng ghế?',
        )

      if (!confirmed) {
        return
      }

      setProcessing(true)

      try {
        await deleteBooking(
          booking.bookingCode,
          reason.trim(),
        )

        setEditing(false)
        await load()
      } catch (requestError) {
        window.alert(
          getApiErrorMessage(
            requestError,
          ),
        )
      } finally {
        setProcessing(false)
      }
    }

  const markCurrentNoShow =
    async () => {
      const reason = window.prompt(
        'Nhập lý do khách không đi:',
      )

      if (
        !reason ||
        reason.trim().length < 5 ||
        reason.trim().length > 500
      ) {
        window.alert(
          'Lý do không đi phải có từ 5 đến 500 ký tự.',
        )
        return
      }

      const confirmed =
        window.confirm(
          'Xác nhận khách không đi?',
        )

      if (!confirmed) {
        return
      }

      setProcessing(true)

      try {
        await markNoShow(
          booking.bookingCode,
          reason.trim(),
        )

        setEditing(false)
        await load()
      } catch (requestError) {
        window.alert(
          getApiErrorMessage(
            requestError,
          ),
        )
      } finally {
        setProcessing(false)
      }
    }

  const collectCurrentPayment = async () => {
    if (!window.confirm(`Xác nhận đã nhận đủ ${formatCurrency(booking.totalAmount ?? 0)} từ khách?`)) {
      return
    }

    setProcessing(true)
    try {
      await collectBookingPayment(booking.bookingCode)
      window.alert('Đã xác nhận thu tiền của vé.')
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessing(false)
    }
  }

  const undoCurrentPayment = async () => {
    const reason = window.prompt('Nhập lý do hoàn tác xác nhận thu tiền:')
    const normalizedReason = reason?.trim() ?? ''

    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      window.alert('Lý do hoàn tác phải có từ 5 đến 500 ký tự.')
      return
    }

    if (!window.confirm('Xác nhận đưa thanh toán về Chưa thanh toán?')) return

    setProcessing(true)
    try {
      await undoBookingPayment(booking.bookingCode, normalizedReason)
      window.alert('Đã hoàn tác xác nhận thu tiền.')
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessing(false)
    }
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={load}
      />
    )
  }

  if (loading) {
    return <LoadingState />
  }

  if (!booking) {
    return (
      <EmptyState message="Không tìm thấy vé." />
    )
  }

  const payment =
    booking.payments?.[0] ??
    booking.payment ??
    null

  const items =
    booking.items ??
    booking.seats ??
    []

  const departureTime =
    booking.trip?.departureTime

  const canCancel =
    booking.status === 'CONFIRMED' &&
    departureTime &&
    new Date(departureTime) > new Date()

  const effectivePaymentStatus = payment?.status || booking.paymentStatus

  const canDelete =
    booking.status === 'CONFIRMED' &&
    !['SUCCESS', 'REFUNDED'].includes(effectivePaymentStatus) &&
    departureTime &&
    new Date(departureTime) > new Date()

  const tripHasDeparted = ['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(
    booking.trip?.status,
  )

  const canEdit =
    booking.status === 'CONFIRMED' &&
    departureTime &&
    new Date(departureTime).getTime() > currentTime.getTime() &&
    !tripHasDeparted

  const canMarkNoShow =
    booking.status ===
      'CONFIRMED' &&
    departureTime &&
    new Date(departureTime) <=
      new Date()


  const canCollectPayment =
    booking.status === 'CONFIRMED' &&
    payment?.paymentMethod === 'PAY_AT_BUS' &&
    payment?.status === 'PENDING'

  const canUndoPayment =
    user?.role === 'ADMIN' &&
    booking.status === 'CONFIRMED' &&
    payment?.paymentMethod === 'PAY_AT_BUS' &&
    payment?.status === 'SUCCESS'

  const pickupPoint =
    booking.pickupPoint ??
    booking.pickupLocation ??
    booking.pickupAddress ??
    booking.trip?.route
      ?.departureLocation

  const dropoffPoint =
    booking.dropoffPoint ??
    booking.dropoffLocation ??
    booking.dropoffAddress ??
    booking.trip?.route
      ?.arrivalLocation

  return (
    <>
      <AdminPageHeader
        title="Chi tiết vé"
        description={`Mã vé: ${formatBookingCode(booking.bookingCode)}`}
      />

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link
          className="btn btn-outline-secondary"
          to="/admin/ve-xe"
        >
          ← Quay lại
        </Link>

        <button
          className="btn btn-primary"
          disabled={processing}
          onClick={printTicket}
          type="button"
        >
          In vé
        </button>

        <button
          className="btn btn-outline-primary"
          disabled={processing || !booking.passengerEmail}
          onClick={resendEmail}
          type="button"
        >
          Gửi lại email vé
        </button>

        {canEdit && (
          <Link
            className="btn btn-outline-primary"
            to={`/admin/ve-xe/${booking.bookingCode}/sua`}
          >
            Sửa thông tin
          </Link>
        )}

        {canCollectPayment && (
          <button
            className="btn btn-success"
            disabled={processing}
            onClick={collectCurrentPayment}
            type="button"
          >
            Đã thu tiền
          </button>
        )}

        {canUndoPayment && (
          <button
            className="btn btn-outline-warning"
            disabled={processing}
            onClick={undoCurrentPayment}
            type="button"
          >
            Hoàn tác thu tiền
          </button>
        )}

        {canCancel && (
          <button
            className="btn btn-danger"
            disabled={processing}
            onClick={
              cancelCurrentBooking
            }
            type="button"
          >
            Hủy vé
          </button>
        )}

        {canDelete && (
          <Link
            className="btn btn-outline-danger"
            to={`/admin/ve-xe/${booking.bookingCode}/xoa`}
          >
            Xóa vé
          </Link>
        )}

        {canMarkNoShow && (
          <button
            className="btn btn-warning"
            disabled={processing}
            onClick={
              markCurrentNoShow
            }
            type="button"
          >
            Không đi
          </button>
        )}
      </div>

      {editing && canEdit && (
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>
                Sửa thông tin hành khách
              </h2>

              <p>
                Chỉ thay đổi thông tin
                liên hệ, không thay đổi
                chuyến và ghế.
              </p>
            </div>
          </div>

          <form
            className="admin-form-grid"
            onSubmit={saveContact}
          >
            <label>
              Họ và tên

              <input
                className="form-control"
                name="passengerFullName"
                onBlur={(event) =>
                  setForm((current) => ({
                    ...current,
                    passengerFullName: normalizeFullName(event.target.value),
                  }))
                }
                onChange={changeField}
                required
                value={
                  form.passengerFullName
                }
              />
            </label>

            <label>
              Số điện thoại

              <input
                className="form-control"
                inputMode="tel"
                maxLength={12}
                name="passengerPhone"
                onChange={changeField}
                placeholder="0912 345 678"
                required
                value={
                  form.passengerPhone
                }
              />
            </label>

            <label className="admin-field--wide">
              Ghi chú nhân viên

              <textarea
                className="form-control"
                maxLength={500}
                name="staffNote"
                onChange={changeField}
                placeholder="Ghi chú riêng của nhân viên về vé"
                rows={3}
                value={form.staffNote}
              />
            </label>

            <div className="admin-row-actions">
              <button
                className="btn btn-primary"
                disabled={saving}
                type="submit"
              >
                {saving
                  ? 'Đang lưu...'
                  : 'Lưu thay đổi'}
              </button>

              <button
                className="btn btn-outline-secondary"
                disabled={saving}
                onClick={() =>
                  setEditing(false)
                }
                type="button"
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>
              NHÀ XE THÀNH NHÂN
            </h2>

            <p>
              Vé xe điện tử
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
          <div>
            <span>
              Hành khách
            </span>

            <strong>
              {booking.passengerFullName ||
                'Chưa cập nhật'}
            </strong>
          </div>

          <div>
            <span>
              Số điện thoại
            </span>

            <strong>
              {booking.passengerPhone
                ? formatPhoneInput(booking.passengerPhone)
                : 'Chưa cập nhật'}
            </strong>
          </div>

          <div>
            <span>Email</span>

            <strong>
              {booking.passengerEmail ||
                'Chưa cập nhật'}
            </strong>
          </div>

          <div>
            <span>
              Ngày đặt vé
            </span>

            <strong>
              {displayDateTime(
                booking.createdAt,
              )}
            </strong>
          </div>

          <div>
            <span>
              Tuyến đường
            </span>

            <strong>
              {booking.trip?.route
                ?.routeName ||
                'Chưa xác định'}
            </strong>
          </div>

          <div>
            <span>
              Ngày giờ xuất bến
            </span>

            <strong>
              {displayDateTime(
                departureTime,
              )}
            </strong>
          </div>

          <div>
            <span>
              Điểm đón
            </span>

            <strong>
              {displayLocation(
                pickupPoint,
              )}
            </strong>
          </div>

          <div>
            <span>
              Điểm trả
            </span>

            <strong>
              {displayLocation(
                dropoffPoint,
              )}
            </strong>
          </div>

          <div>
            <span>Xe</span>

            <strong>
              {booking.trip?.bus
                ?.busName ||
                'Chưa cập nhật'}
            </strong>
          </div>

          <div>
            <span>
              Biển số
            </span>

            <strong>
              {booking.trip?.bus?.licensePlate
                ? formatLicensePlate(booking.trip.bus.licensePlate)
                : 'Chưa cập nhật'}
            </strong>
          </div>

          <div>
            <span>
              Loại xe
            </span>

            <strong>
              {booking.trip?.bus?.busType
                ? getBusTypeLabel(booking.trip.bus.busType)
                : 'Chưa cập nhật'}
            </strong>
          </div>

          <div>
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
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>
              Chi tiết ghế
            </h2>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState message="Vé chưa có thông tin ghế." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã ghế</th>
                  <th>Loại ghế</th>
                  <th>Giá vé</th>
                </tr>
              </thead>

              <tbody>
                {items.map(
                  (item, index) => (
                    <tr
                      key={
                        item.id ??
                        item.tripSeatId ??
                        `${item.seatCode}-${index}`
                      }
                    >
                      <td>
                        <strong>
                          {item.seatCode ||
                            '—'}
                        </strong>
                      </td>

                      <td>
                        {item.seatType
                          ? getSeatTypeLabel(item.seatType)
                          : 'Chưa xác định'}
                      </td>

                      <td>
                        {formatCurrency(
                          item.price ??
                            0,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>
              Thanh toán
            </h2>
          </div>
        </div>

        <div className="admin-form-grid">
          <div>
            <span>
              Phương thức
            </span>

            <strong>
              {getPaymentMethodLabel(
                payment
                  ?.paymentMethod,
              )}
            </strong>
          </div>

          <div>
            <span>
              Trạng thái
            </span>

            <strong>
              {getPaymentStatusLabel(
                payment?.status ??
                  booking.paymentStatus,
              )}
            </strong>
          </div>

          <div>
            <span>
              Số tiền
            </span>

            <strong>
              {formatCurrency(
                payment?.amount ??
                  booking.totalAmount ??
                  0,
              )}
            </strong>
          </div>

          <div>
            <span>
              Mã giao dịch
            </span>

            <strong>
              {payment
                ?.transactionCode ||
                'Chưa có'}
            </strong>
          </div>

          <div>
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
      </section>

      {(booking.customerNote ||
        booking.staffNote ||
        booking.cancellationReason ||
        booking.noShowReason ||
        booking.deletedReason) && (
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>
                Ghi chú và lý do
              </h2>
            </div>
          </div>

          <div className="admin-form-grid">
            {booking.customerNote && (
              <div>
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
              <div>
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

            {booking.cancellationReason && (
              <div>
                <span>
                  Lý do hủy
                </span>

                <strong>
                  {
                    booking.cancellationReason
                  }
                </strong>

                <small>
                  Hủy lúc:{' '}
                  {displayDateTime(
                    booking.cancelledAt,
                  )}
                </small>
              </div>
            )}

            {booking.noShowReason && (
              <div>
                <span>
                  Lý do không đi
                </span>

                <strong>
                  {
                    booking.noShowReason
                  }
                </strong>

                <small>
                  Ghi nhận lúc:{' '}
                  {displayDateTime(
                    booking.noShowAt,
                  )}
                </small>
              </div>
            )}

            {booking.deletedReason && (
              <div>
                <span>
                  Lý do xóa vé
                </span>

                <strong>
                  {
                    booking.deletedReason
                  }
                </strong>

                <small>
                  Xóa lúc:{' '}
                  {displayDateTime(
                    booking.deletedAt,
                  )}
                </small>
              </div>
            )}
          </div>
        </section>
      )}

      <p className="text-center mt-4">
        Cảm ơn quý khách đã sử dụng
        dịch vụ Nhà xe Thành Nhân.
      </p>

      <BookingTicket
        booking={booking}
      />
    </>
  )
}

export default AdminBookingDetailPage