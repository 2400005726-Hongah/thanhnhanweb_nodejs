import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import BookingTicket from '../../components/admin/BookingTicket.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  cancelBooking,
  deleteBooking,
  getBookings,
  markNoShow,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate, formatPhoneInput } from '../../utils/normalizers.js'
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../../utils/paymentLabels.js'

const BOOKING_PAGE_SIZE = 30

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

const EMPTY_FILTERS = {
  keyword: '',
  source: '',
  status: '',
  paymentStatus: '',
  from: '',
  to: '',
}

const displayDateTime = (value) =>
  value ? formatDateTime(value) : '—'

const getStatusClass = (status) => {
  if (['CANCELLED', 'NO_SHOW', 'DELETED'].includes(status)) {
    return 'status-badge status-badge--cancelled'
  }

  if (['PENDING', 'EXPIRED'].includes(status)) {
    return 'status-badge status-badge--pending'
  }

  return 'status-badge status-badge--active'
}

const escapeCsvCell = (value) => {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

const downloadCsv = (bookings) => {
  const header = [
    'Mã vé',
    'Nguồn đặt',
    'Hành khách',
    'Số điện thoại',
    'Email',
    'Tuyến',
    'Giờ xuất bến',
    'Biển số',
    'Ghế/phòng',
    'Điểm đón chi tiết',
    'Điểm trả chi tiết',
    'Tổng tiền',
    'Trạng thái vé',
    'Trạng thái thanh toán',
    'Phương thức thanh toán',
    'Ngày đặt',
  ]

  const rows = bookings.map((booking) => {
    const payment = booking.payments?.[0] ?? booking.payment ?? null

    return [
      booking.bookingCode,
      SOURCE_LABELS[booking.source] || 'Chưa xác định',
      booking.passengerFullName,
      formatPhoneInput(booking.passengerPhone),
      booking.passengerEmail,
      booking.trip?.route?.routeName,
      displayDateTime(booking.trip?.departureTime),
      formatLicensePlate(booking.trip?.bus?.licensePlate),
      booking.items?.map((item) => item.seatCode).join(', '),
      booking.pickupPoint,
      booking.dropoffPoint,
      Number(booking.totalAmount || 0),
      BOOKING_STATUS_LABELS[booking.status] || 'Không xác định',
      getPaymentStatusLabel(booking.paymentStatus),
      getPaymentMethodLabel(payment?.paymentMethod),
      displayDateTime(booking.createdAt),
    ]
  })

  const content = [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')

  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `danh-sach-ve-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [pagination, setPagination] = useState(null)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingCode, setProcessingCode] = useState('')
  const [printBooking, setPrintBooking] = useState(null)

  const load = useCallback(async (targetPage = 1, nextFilters = EMPTY_FILTERS) => {
    setLoading(true)
    setError('')

    try {
      const data = await getBookings({
        page: targetPage,
        limit: BOOKING_PAGE_SIZE,
        ...(nextFilters.keyword && { keyword: nextFilters.keyword }),
        ...(nextFilters.source && { source: nextFilters.source }),
        ...(nextFilters.status && { status: nextFilters.status }),
        ...(nextFilters.paymentStatus && {
          paymentStatus: nextFilters.paymentStatus,
        }),
        ...(nextFilters.from && { from: nextFilters.from }),
        ...(nextFilters.to && { to: nextFilters.to }),
      })

      setBookings(data?.bookings ?? [])
      setPagination(data?.pagination ?? null)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, appliedFilters)
  }, [appliedFilters, load, page])

  useEffect(() => {
    const clearPrintBooking = () => setPrintBooking(null)
    window.addEventListener('afterprint', clearPrintBooking)
    return () => window.removeEventListener('afterprint', clearPrintBooking)
  }, [])

  const changeFilter = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const submit = (event) => {
    event.preventDefault()

    if (filters.from && filters.to && filters.from > filters.to) {
      window.alert('Ngày bắt đầu không được sau ngày kết thúc.')
      return
    }

    setPage(1)
    setAppliedFilters({
      keyword: filters.keyword.trim(),
      source: filters.source,
      status: filters.status,
      paymentStatus: filters.paymentStatus,
      from: filters.from,
      to: filters.to,
    })
  }

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS })
    setAppliedFilters({ ...EMPTY_FILTERS })
    setPage(1)
  }

  const printTicket = (booking) => {
    setPrintBooking(booking)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print())
    })
  }

  const runReasonAction = async ({
    booking,
    promptMessage,
    confirmMessage,
    validationMessage,
    action,
  }) => {
    const reason = window.prompt(promptMessage)
    const normalizedReason = reason?.trim() ?? ''

    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      window.alert(validationMessage)
      return
    }

    if (!window.confirm(confirmMessage)) return

    setProcessingCode(booking.bookingCode)
    try {
      await action(booking.bookingCode, normalizedReason)
      await load(page, appliedFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingCode('')
    }
  }

  const cancel = (booking) =>
    runReasonAction({
      booking,
      promptMessage: `Nhập lý do hủy vé ${booking.bookingCode}:`,
      confirmMessage: `Xác nhận hủy vé ${booking.bookingCode}?`,
      validationMessage: 'Lý do hủy vé phải có từ 5 đến 500 ký tự.',
      action: cancelBooking,
    })

  const removeBooking = (booking) =>
    runReasonAction({
      booking,
      promptMessage: `Nhập lý do xóa vé ${booking.bookingCode}:`,
      confirmMessage: `Xóa mềm vé ${booking.bookingCode} và giải phóng ghế?`,
      validationMessage: 'Lý do xóa vé phải có từ 5 đến 500 ký tự.',
      action: deleteBooking,
    })

  const noShow = (booking) =>
    runReasonAction({
      booking,
      promptMessage: `Nhập lý do khách không đi cho vé ${booking.bookingCode}:`,
      confirmMessage: `Xác nhận khách không đi cho vé ${booking.bookingCode}?`,
      validationMessage: 'Lý do không đi phải có từ 5 đến 500 ký tự.',
      action: markNoShow,
    })

  return (
    <>
      <AdminPageHeader
        title="Vé xe"
        description="Quản lý vé Trực tuyến, Hotline và Tại quầy."
        actions={(
          <button
            className="btn btn-success"
            disabled={bookings.length === 0}
            onClick={() => downloadCsv(bookings)}
            type="button"
          >
            Xuất CSV trang hiện tại
          </button>
        )}
      />

      <form className="admin-filter-bar" onSubmit={submit}>
        <input
          className="form-control"
          name="keyword"
          onChange={changeFilter}
          placeholder="Mã vé, hành khách hoặc số điện thoại"
          value={filters.keyword}
        />

        <select
          className="form-select"
          name="source"
          onChange={changeFilter}
          value={filters.source}
        >
          <option value="">Tất cả nguồn đặt</option>
          <option value="ONLINE">Trực tuyến</option>
          <option value="HOTLINE">Hotline</option>
          <option value="COUNTER">Tại quầy</option>
        </select>

        <select
          className="form-select"
          name="status"
          onChange={changeFilter}
          value={filters.status}
        >
          <option value="">Tất cả trạng thái vé</option>
          {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          className="form-select"
          name="paymentStatus"
          onChange={changeFilter}
          value={filters.paymentStatus}
        >
          <option value="">Tất cả thanh toán</option>
          <option value="PENDING">Chờ thanh toán</option>
          <option value="SUCCESS">Đã thanh toán</option>
          <option value="FAILED">Thanh toán thất bại</option>
          <option value="REFUNDED">Đã hoàn tiền</option>
        </select>

        <label className="admin-field">
          <span>Từ ngày đặt</span>
          <input
            className="form-control"
            name="from"
            onChange={changeFilter}
            type="date"
            value={filters.from}
          />
        </label>

        <label className="admin-field">
          <span>Đến ngày đặt</span>
          <input
            className="form-control"
            name="to"
            onChange={changeFilter}
            type="date"
            value={filters.to}
          />
        </label>

        <div className="d-flex gap-2">
          <button className="btn btn-primary" type="submit">Tìm vé</button>
          <button
            className="btn btn-outline-secondary"
            onClick={clearFilters}
            type="button"
          >
            Xóa lọc
          </button>
        </div>
      </form>

      {error ? (
        <ErrorState message={error} onRetry={() => load(page, appliedFilters)} />
      ) : loading ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <EmptyState message="Không tìm thấy vé phù hợp." />
      ) : (
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Danh sách vé</h2>
              <p>Hiển thị nguồn đặt, trạng thái vé, thanh toán và điểm đón/trả.</p>
            </div>
            <strong>{pagination?.total ?? bookings.length} vé</strong>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã vé</th>
                  <th>Hành khách</th>
                  <th>Chuyến xe</th>
                  <th>Xe/Ghế</th>
                  <th>Nguồn đặt</th>
                  <th>Điểm đón/trả</th>
                  <th>Giá vé</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking, index) => {
                  const payment = booking.payments?.[0] ?? booking.payment ?? null
                  const departureTime = booking.trip?.departureTime
                  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status)
                  const canDelete =
                    ['PENDING', 'CONFIRMED'].includes(booking.status) &&
                    departureTime &&
                    new Date(departureTime) > new Date()
                  const canMarkNoShow =
                    booking.status === 'CONFIRMED' &&
                    departureTime &&
                    new Date(departureTime) <= new Date()
                  const isProcessing = processingCode === booking.bookingCode

                  return (
                    <tr key={booking.id}>
                      <td>{(page - 1) * BOOKING_PAGE_SIZE + index + 1}</td>
                      <td>
                        <strong>{booking.bookingCode}</strong>
                        <small>Đặt lúc: {displayDateTime(booking.createdAt)}</small>
                      </td>
                      <td>
                        <strong>{booking.passengerFullName || 'Chưa cập nhật'}</strong>
                        <small>{booking.passengerPhone ? formatPhoneInput(booking.passengerPhone) : 'Chưa cập nhật'}</small>
                        <small>{booking.passengerEmail || 'Chưa có email'}</small>
                      </td>
                      <td>
                        <strong>{booking.trip?.route?.routeName || 'Chưa xác định'}</strong>
                        <small>Xuất bến: {displayDateTime(departureTime)}</small>
                      </td>
                      <td>
                        <strong>{booking.trip?.bus?.licensePlate ? formatLicensePlate(booking.trip.bus.licensePlate) : 'Chưa có xe'}</strong>
                        <small>
                          Ghế: {booking.items?.map((item) => item.seatCode).join(', ') || '—'}
                        </small>
                      </td>
                      <td>
                        <span className="status-badge status-badge--active">
                          {SOURCE_LABELS[booking.source] || 'Chưa xác định'}
                        </span>
                      </td>
                      <td>
                        <strong>{booking.pickupPoint || 'Theo điểm đi của tuyến'}</strong>
                        <small>{booking.dropoffPoint || 'Theo điểm đến của tuyến'}</small>
                      </td>
                      <td><strong>{formatCurrency(booking.totalAmount ?? 0)}</strong></td>
                      <td>
                        <span className={getStatusClass(booking.status)}>
                          {BOOKING_STATUS_LABELS[booking.status] || 'Chưa xác định'}
                        </span>
                      </td>
                      <td>
                        <strong>{getPaymentStatusLabel(booking.paymentStatus)}</strong>
                        <small>{getPaymentMethodLabel(payment?.paymentMethod)}</small>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <Link to={`/admin/ve-xe/${booking.bookingCode}`}>Chi tiết</Link>
                          <button
                            disabled={isProcessing}
                            onClick={() => printTicket(booking)}
                            type="button"
                          >
                            In vé
                          </button>
                          {canCancel && (
                            <button
                              disabled={isProcessing}
                              onClick={() => cancel(booking)}
                              type="button"
                            >
                              Hủy vé
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="is-danger"
                              disabled={isProcessing}
                              onClick={() => removeBooking(booking)}
                              type="button"
                            >
                              Xóa vé
                            </button>
                          )}
                          {canMarkNoShow && (
                            <button
                              disabled={isProcessing}
                              onClick={() => noShow(booking)}
                              type="button"
                            >
                              Không đi
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {(pagination?.totalPages ?? 1) > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <button
                className="btn btn-outline-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Trang trước
              </button>
              <strong>Trang {pagination?.page ?? page}/{pagination?.totalPages ?? 1}</strong>
              <button
                className="btn btn-outline-secondary"
                disabled={page >= (pagination?.totalPages ?? 1) || loading}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Trang sau
              </button>
            </div>
          )}
        </section>
      )}

      <BookingTicket booking={printBooking} />
    </>
  )
}

export default AdminBookingsPage
