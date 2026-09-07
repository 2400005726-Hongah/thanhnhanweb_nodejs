import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { createRoot } from 'react-dom/client'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import BookingTicket from '../../components/admin/BookingTicket.jsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import {
  cancelBooking,
  collectBookingPayment,
  deleteBooking,
  exportBookingsExcel,
  getBookings,
  markNoShow,
  undoBookingPayment,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatBookingCode, formatPhoneInput } from '../../utils/normalizers.js'
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../../utils/paymentLabels.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'

import './AdminBookingsPage.css'

const BOOKING_PAGE_SIZE = 20

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
  ONLINE: 'Online',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}

const SERVICE_MODE_LABELS = {
  TaiVanPhong: 'Tập trung tại văn phòng nhà xe',
  DonTaiBenXe: 'Đón trực tiếp tại bến xe trung tâm',
  DonTaiDiemHen: 'Đón khách tại điểm hẹn',
  TrungChuyenDonKhach: 'Xe trung chuyển đón khách',
  TraTaiBenXe: 'Trả khách tại bến xe trung tâm đích đến',
  TraTaiVanPhong: 'Trả khách tại văn phòng nhà xe',
  TraTaiDiemDung: 'Trả khách tại điểm dừng',
  TrungChuyenTraKhach: 'Xe trung chuyển trả tận nơi khu vực nội thành',
}

const EMPTY_FILTERS = {
  keyword: '',
  source: '',
  status: '',
  paymentStatus: '',
  departureDate: '',
}

const toDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateOnly = (value) => {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const formatTimeOnly = (value) => {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const getStatusClass = (status) => {
  if (['CANCELLED', 'DELETED'].includes(status)) return 'is-red'
  if (['NO_SHOW', 'PENDING', 'EXPIRED'].includes(status)) return 'is-yellow'
  if (status === 'COMPLETED') return 'is-green'
  return 'is-red'
}

const getSourceClass = (source) => {
  if (source === 'ONLINE') return 'is-online'
  if (source === 'HOTLINE') return 'is-hotline'
  return 'is-counter'
}

const getTripEndpoints = (booking) => {
  const trip = booking.trip || {}
  const departure =
    trip.departureLocation?.name ||
    trip.route?.departureLocation?.name ||
    trip.route?.routeName?.split('→')?.[0]?.trim() ||
    'Chưa xác định'
  const arrival =
    trip.arrivalLocation?.name ||
    trip.route?.arrivalLocation?.name ||
    trip.route?.routeName?.split('→')?.[1]?.trim() ||
    'Chưa xác định'
  return { departure, arrival }
}

const getServiceModeLabel = (mode, fallback) =>
  SERVICE_MODE_LABELS[mode] || fallback

const getPendingPaymentLabel = (payment) => {
  if (payment?.status === 'PENDING' && payment?.paymentMethod === 'PAY_AT_BUS') {
    return 'Chờ thu tiền tại xe'
  }
  return getPaymentStatusLabel(payment?.status || 'PENDING')
}

const ActionIcon = ({ type }) => {
  const common = {
    width: 13,
    height: 13,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (type === 'view') {
    return (
      <svg {...common}>
        <path d="M1.5 8s2.3-4.2 6.5-4.2S14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8Z" />
        <circle cx="8" cy="8" r="1.8" />
      </svg>
    )
  }
  if (type === 'print') {
    return (
      <svg {...common}>
        <path d="M4 5V1.8h8V5" />
        <path d="M4 11H2.5V6.4h11V11H12" />
        <path d="M4 9h8v5H4z" />
      </svg>
    )
  }
  if (type === 'edit') {
    return (
      <svg {...common}>
        <path d="M10.7 2.2 13.8 5.3 6 13.1l-3.8.7.7-3.8 7.8-7.8Z" />
        <path d="m9.5 3.4 3.1 3.1" />
      </svg>
    )
  }
  if (type === 'cash') {
    return (
      <svg {...common}>
        <rect x="1.7" y="3" width="12.6" height="9.8" rx="1.4" />
        <circle cx="8" cy="7.9" r="2" />
      </svg>
    )
  }
  if (type === 'undo') {
    return (
      <svg {...common}>
        <path d="M5.3 4.2 2.4 7l2.9 2.8" />
        <path d="M2.8 7h6.1a4 4 0 0 1 0 8" />
      </svg>
    )
  }
  if (type === 'trash') {
    return (
      <svg {...common}>
        <path d="M3 4.2h10M6 4.2V2.3h4v1.9M4.2 4.2l.7 9.5h6.2l.7-9.5" />
        <path d="M6.6 6.4v5M9.4 6.4v5" />
      </svg>
    )
  }
  if (type === 'no-show') {
    return (
      <svg {...common}>
        <circle cx="6" cy="5.1" r="2.1" />
        <path d="M2.4 13c.3-2.6 1.7-4 3.6-4 1.4 0 2.4.6 3 1.5" />
        <path d="m10.3 9.8 3.4 3.4M13.7 9.8l-3.4 3.4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M3 3l10 10M13 3 3 13" />
    </svg>
  )
}

function AdminBookingsPage() {
  const location = useLocation()
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [pagination, setPagination] = useState(null)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingCode, setProcessingCode] = useState('')
  const [exporting, setExporting] = useState(false)
  const [actionDialog, setActionDialog] = useState(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())

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
        ...(nextFilters.paymentStatus && { paymentStatus: nextFilters.paymentStatus }),
        ...(nextFilters.departureDate && { departureDate: nextFilters.departureDate }),
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
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [])

  const totalCount = pagination?.total ?? bookings.length
  const canManageBookings = hasPermission(user, PERMISSIONS.MANAGE_BOOKINGS)
  const canMarkNoShowPermission = hasPermission(user, PERMISSIONS.MARK_NO_SHOW)

  const changeFilter = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({
      keyword: filters.keyword.trim(),
      source: filters.source,
      status: filters.status,
      paymentStatus: filters.paymentStatus,
      departureDate: filters.departureDate,
    })
  }

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS })
    setAppliedFilters({ ...EMPTY_FILTERS })
    setPage(1)
  }

  const exportExcel = async () => {
    setExporting(true)
    try {
      const response = await exportBookingsExcel({
        ...(appliedFilters.keyword && { keyword: appliedFilters.keyword }),
        ...(appliedFilters.source && { source: appliedFilters.source }),
        ...(appliedFilters.status && { status: appliedFilters.status }),
        ...(appliedFilters.paymentStatus && { paymentStatus: appliedFilters.paymentStatus }),
        ...(appliedFilters.departureDate && { departureDate: appliedFilters.departureDate }),
      })

      const disposition = response.headers?.['content-disposition'] || ''
      const matchedName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
      const fileName = matchedName || `DanhSachVe_${new Date().toISOString().slice(0, 10)}.xlsx`
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setExporting(false)
    }
  }

  const printTicket = async (booking) => {
  const iframe = document.createElement('iframe')

  iframe.setAttribute('aria-hidden', 'true')

  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  })

  document.body.appendChild(iframe)

  const printWindow = iframe.contentWindow
  const printDocument = iframe.contentDocument

  if (!printWindow || !printDocument) {
    iframe.remove()
    window.alert('Không thể tạo vùng in vé.')
    return
  }

  printDocument.open()

  printDocument.write(`
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <title>
          Vé ${booking.bookingCode || ''}
        </title>

        <style>
          html,
          body{
            margin:0;
            padding:0;
            background:#fff;
          }

          body{
            font-family:Arial,sans-serif;
          }

          #print-root{
            margin:0;
            padding:0;
          }
        </style>
      </head>

      <body>
        <div id="print-root"></div>
      </body>
    </html>
  `)

  printDocument.close()

  const mountNode =
    printDocument.getElementById('print-root')

  if (!mountNode) {
    iframe.remove()
    window.alert('Không tìm thấy vùng in vé.')
    return
  }

  const root = createRoot(mountNode)

  root.render(
    <BookingTicket booking={booking} />,
  )

  const waitRender = () =>
    new Promise((resolve) => {
      printWindow.requestAnimationFrame(() => {
        printWindow.requestAnimationFrame(
          resolve,
        )
      })
    })

  const waitImages = async () => {
    const images = Array.from(
      printDocument.images,
    )

    await Promise.all(
      images.map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve()
              return
            }

            image.addEventListener(
              'load',
              resolve,
              { once: true },
            )

            image.addEventListener(
              'error',
              resolve,
              { once: true },
            )
          }),
      ),
    )
  }

  try {
    await waitRender()
    await waitImages()

    await new Promise((resolve) =>
      setTimeout(resolve, 150),
    )

    const cleanup = () => {
      try {
        root.unmount()
      } catch {
        // Không cần xử lý
      }

      iframe.remove()
    }

    printWindow.onafterprint = cleanup

    printWindow.focus()
    printWindow.print()
  } catch {
    try {
      root.unmount()
    } catch {
      // Không cần xử lý
    }

    iframe.remove()

    window.alert(
      'Không thể chuẩn bị vé để in.',
    )
  }
}

  const openActionDialog = (type, booking) => {
    setActionDialog({
      type,
      booking,
      reason: '',
      confirmed: false,
    })
  }

  const closeActionDialog = () => {
    if (processingCode) return
    setActionDialog(null)
  }

  const updateActionDialog = (patch) => {
    setActionDialog((current) => (current ? { ...current, ...patch } : current))
  }

  const executeActionDialog = async () => {
    if (!actionDialog?.booking) return

    const { booking, type } = actionDialog
    const reason = actionDialog.reason.trim()

    if (type !== 'collect' && (reason.length < 5 || reason.length > 500)) {
      window.alert('Lý do phải có từ 5 đến 500 ký tự.')
      return
    }

    if (type === 'collect' && actionDialog.confirmed !== true) {
      window.alert('Bạn phải tích xác nhận đã nhận đủ tiền từ khách.')
      return
    }

    setProcessingCode(booking.bookingCode)
    try {
      if (type === 'collect') {
        await collectBookingPayment(booking.bookingCode)
      } else if (type === 'undo') {
        await undoBookingPayment(booking.bookingCode, reason)
      } else if (type === 'cancel') {
        await cancelBooking(booking.bookingCode, reason)
      } else if (type === 'delete') {
        await deleteBooking(booking.bookingCode, reason)
      } else if (type === 'no-show') {
        await markNoShow(booking.bookingCode, reason)
      }

      setActionDialog(null)
      await load(page, appliedFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingCode('')
    }
  }

  const getActionDialogContent = () => {
    if (!actionDialog?.booking) return null
    const booking = actionDialog.booking
    const payment = booking.payments?.[0] ?? booking.payment ?? null
    const seatCodes = (booking.items || []).map((item) => item.seatCode).filter(Boolean).join(', ') || '—'

    if (actionDialog.type === 'collect') {
      return {
        title: 'Xác nhận đã thu tiền',
        description: 'Chỉ xác nhận khi bạn đã thực sự nhận đủ tiền từ khách.',
        confirmLabel: 'Xác nhận đã thu tiền',
        tone: 'success',
        payment,
        seatCodes,
      }
    }

    const map = {
      undo: {
        title: 'Hoàn tác xác nhận thu tiền',
        description: 'Đưa trạng thái thanh toán của vé về Chưa thanh toán. Số tiền phải thu vẫn được giữ lại.',
        confirmLabel: 'Hoàn tác',
        reasonLabel: 'Lý do hoàn tác',
      },
      cancel: {
        title: 'Hủy vé',
        description: 'Ghế sẽ được mở lại. Nếu vé đã thanh toán, hệ thống ghi nhận hoàn tiền 100%.',
        confirmLabel: 'Hủy vé',
        reasonLabel: 'Lý do hủy vé',
      },
      delete: {
        title: 'Xóa vé',
        description: 'Đây là xóa mềm dành cho vé nhập nhầm. Ghế được mở lại và lịch sử vé vẫn còn.',
        confirmLabel: 'Xóa mềm',
        reasonLabel: 'Lý do xóa vé',
      },
      'no-show': {
        title: 'Khách không đi',
        description: 'Ghế không được mở lại và trạng thái thanh toán được giữ nguyên.',
        confirmLabel: 'Xác nhận không đi',
        reasonLabel: 'Lý do khách không đi',
      },
    }

    return {
      ...map[actionDialog.type],
      tone: actionDialog.type === 'no-show' ? 'warning' : 'danger',
      payment,
      seatCodes,
    }
  }

  const renderedRows = useMemo(
    () =>
      bookings.map((booking) => {
        const payment = booking.payments?.[0] ?? booking.payment ?? null
        const departureTime = booking.trip?.departureTime
        const { departure, arrival } = getTripEndpoints(booking)
        return { booking, payment, departureTime, departure, arrival }
      }),
    [bookings],
  )

  return (
    <div className="admin-bookings-mvc-page">
      <AdminPageHeader title="Quản lý vé xe" />

      {location.state?.notice && (
        <div className="alert alert-success" role="status">
          {location.state.notice}
        </div>
      )}

      <section className="admin-bookings-filter-card">
        <form onSubmit={submit}>
          <div className="admin-bookings-filter-grid">
            <label className="admin-bookings-filter-field admin-bookings-filter-field--search">
              <span>Tìm kiếm</span>
              <input
                className="form-control"
                name="keyword"
                onChange={changeFilter}
                placeholder="Mã vé, mã giao dịch, tên hoặc SĐT"
                value={filters.keyword}
              />
            </label>

            <label className="admin-bookings-filter-field">
              <span>Nguồn đặt</span>
              <select className="form-select" name="source" onChange={changeFilter} value={filters.source}>
                <option value="">Tất cả</option>
                <option value="ONLINE">Online</option>
                <option value="HOTLINE">Hotline</option>
                <option value="COUNTER">Tại quầy</option>
              </select>
            </label>

            <label className="admin-bookings-filter-field">
              <span>Trạng thái vé</span>
              <select className="form-select" name="status" onChange={changeFilter} value={filters.status}>
                <option value="">Tất cả</option>
                {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="admin-bookings-filter-field">
              <span>Thanh toán</span>
              <select className="form-select" name="paymentStatus" onChange={changeFilter} value={filters.paymentStatus}>
                <option value="">Tất cả</option>
                <option value="PENDING">Chờ thanh toán</option>
                <option value="SUCCESS">Đã thanh toán</option>
                <option value="FAILED">Thanh toán thất bại</option>
                <option value="REFUNDED">Đã hoàn tiền</option>
              </select>
            </label>

            <label className="admin-bookings-filter-field">
              <span>Ngày xuất bến</span>
              <input
                className="form-control"
                name="departureDate"
                onChange={changeFilter}
                type="date"
                value={filters.departureDate}
              />
            </label>
          </div>

          <div className="admin-bookings-filter-actions">
            <button className="btn admin-bookings-btn admin-bookings-btn--filter" type="submit">
              <span aria-hidden="true">⌕</span> Lọc dữ liệu
            </button>
            <button className="btn admin-bookings-btn admin-bookings-btn--clear" onClick={clearFilters} type="button">
              Xóa bộ lọc
            </button>
            <button
              className="btn admin-bookings-btn admin-bookings-btn--excel"
              disabled={exporting || totalCount === 0}
              onClick={exportExcel}
              type="button"
            >
              <span aria-hidden="true">▣</span> {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={() => load(page, appliedFilters)} />
      ) : loading ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <EmptyState message="Không tìm thấy vé phù hợp." />
      ) : (
        <section className="admin-bookings-list-card">
          <div className="admin-bookings-list-title">
            <h2>Danh sách vé xe ({totalCount} kết quả)</h2>
          </div>

          <div className="admin-bookings-table-scroll">
            <table className="admin-bookings-table">
              <thead>
                <tr>
                  <th>Mã vé</th>
                  <th>Nguồn đặt</th>
                  <th>Chuyến xe</th>
                  <th>Đón / trả</th>
                  <th>Khách hàng</th>
                  <th>Ghế</th>
                  <th>Ngày đặt</th>
                  <th>Xuất bến</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái vé</th>
                  <th>Thanh toán</th>                 
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {renderedRows.map(({ booking, payment, departureTime, departure, arrival }) => {
                  const departureAt = departureTime ? new Date(departureTime) : null
                  const paymentStatus = payment?.status || booking.paymentStatus
                  const isConfirmed = booking.status === 'CONFIRMED'
                  const tripStatus = booking.trip?.status
                  const tripHasDeparted = ['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(tripStatus)
                  const isBeforeDeparture = Boolean(
                    departureAt && departureAt.getTime() > currentTime.getTime() && !tripHasDeparted,
                  )
                  const isAtOrAfterDeparture = Boolean(
                    departureAt && (departureAt.getTime() <= currentTime.getTime() || tripHasDeparted),
                  )
                  const canEdit = canManageBookings && isConfirmed && isBeforeDeparture
                  const canCancel = canManageBookings && isConfirmed && isBeforeDeparture
                  const canDelete =
                    canManageBookings &&
                    isConfirmed &&
                    isBeforeDeparture &&
                    !['SUCCESS', 'REFUNDED'].includes(paymentStatus)
                  const canMarkNoShow = canMarkNoShowPermission && isConfirmed && isAtOrAfterDeparture
                  const canCollectPayment =
                    canManageBookings &&
                    isConfirmed &&
                    payment?.paymentMethod === 'PAY_AT_BUS' &&
                    paymentStatus === 'PENDING'
                  const canUndoPayment =
                    user?.role === 'ADMIN' &&
                    isConfirmed &&
                    payment?.paymentMethod === 'PAY_AT_BUS' &&
                    paymentStatus === 'SUCCESS'
                  const isProcessing = processingCode === booking.bookingCode
                  const shortCode = String(booking.bookingCode || '').slice(-4).toUpperCase()
                  const transactionCode = payment?.transactionCode || booking.transactionCode || booking.bookingCode
                  const pickupMode = getServiceModeLabel(
                    booking.pickupServiceMode,
                    'Điểm đón chính của chuyến',
                  )
                  const dropoffMode = getServiceModeLabel(
                    booking.dropoffServiceMode,
                    'Điểm trả chính của chuyến',
                  )

                  return (
                    <tr key={booking.id || booking.bookingCode}>
                      <td className="admin-bookings-code-cell">
                        <strong>#{shortCode || '—'}</strong>
                        <small>{transactionCode || '—'}</small>
                      </td>

                      <td>
                        <span className={`admin-bookings-source ${getSourceClass(booking.source)}`}>
                          {SOURCE_LABELS[booking.source] || 'Chưa xác định'}
                        </span>
                      </td>

                      <td className="admin-bookings-trip-cell">
                        <strong className="is-departure">● {departure}</strong>
                        <strong className="is-arrival">● {arrival}</strong>
                      </td>

                      <td className="admin-bookings-service-cell">
                        <span className="pickup-label"><b>Đón:</b> {pickupMode}</span>
                        <small>{booking.pickupPoint || departure}</small>
                        <span className="dropoff-label"><b>Trả:</b> {dropoffMode}</span>
                        <small>{booking.dropoffPoint || arrival}</small>
                      </td>

                      <td className="admin-bookings-customer-cell">
                        <strong>{booking.passengerFullName || 'Chưa cập nhật'}</strong>
                        <small>{booking.passengerPhone ? formatPhoneInput(booking.passengerPhone) : 'Chưa cập nhật'}</small>
                      </td>

                      <td className="admin-bookings-seat-cell">
                        {(booking.items?.length ? booking.items : [{ seatCode: '—' }]).map((item) => (
                          <span key={`${booking.bookingCode}-${item.seatCode}`}>
                            {item.seatCode}
                          </span>
                        ))}
                      </td>

                      <td className="admin-bookings-date-cell">
                        <strong>{formatDateOnly(booking.createdAt)}</strong>
                        <small>{formatTimeOnly(booking.createdAt)}</small>
                      </td>

                      <td className="admin-bookings-date-cell">
                        <strong>{formatDateOnly(departureTime)}</strong>
                        <small>{formatTimeOnly(departureTime)}</small>
                      </td>

                      <td className="admin-bookings-money-cell">
                        <strong>{formatCurrency(booking.totalAmount ?? 0)}</strong>
                      </td>

                      <td>
                        <span className={`admin-bookings-status ${getStatusClass(booking.status)}`}>
                          {BOOKING_STATUS_LABELS[booking.status] || 'Chưa xác định'}
                        </span>
                      </td>

                      <td className="admin-bookings-payment-cell admin-bookings-payment-cell--combined">
  <span
    className={`admin-bookings-payment ${
      paymentStatus === 'SUCCESS'
        ? 'is-paid'
        : paymentStatus === 'REFUNDED'
          ? 'is-refunded'
          : 'is-pending'
    }`}
  >
    {paymentStatus === 'PENDING'
      ? getPendingPaymentLabel(payment)
      : getPaymentStatusLabel(paymentStatus)}
  </span>

  <strong className="admin-bookings-payment-method">
    {getPaymentMethodLabel(payment?.paymentMethod)}
  </strong>

  <small className="admin-bookings-payment-date">
    {payment?.paidAt
      ? `${formatDateOnly(payment.paidAt)} ${formatTimeOnly(payment.paidAt)}`
      : 'Chưa có thời gian thanh toán'}
  </small>
</td>

                      <td>
                        <div className="admin-bookings-actions">
                          <Link
                            aria-label="Chi tiết vé"
                            className="admin-bookings-action-btn"
                            title="Chi tiết vé"
                            to={`/admin/ve-xe/${booking.bookingCode}`}
                          >
                            <ActionIcon type="view" />
                          </Link>
                          <button
                            aria-label="In vé"
                            className="admin-bookings-action-btn"
                            disabled={isProcessing}
                            onClick={() => printTicket(booking)}
                            title="In vé"
                            type="button"
                          >
                            <ActionIcon type="print" />
                          </button>
                          {canEdit && (
                            <Link
                              aria-label="Sửa vé"
                              className="admin-bookings-action-btn"
                              title="Sửa vé"
                              to={`/admin/ve-xe/${booking.bookingCode}/sua`}
                            >
                              <ActionIcon type="edit" />
                            </Link>
                          )}
                          {canCollectPayment && (
                            <button
                              aria-label="Đã thu tiền"
                              className="admin-bookings-action-btn"
                              disabled={isProcessing}
                              onClick={() => openActionDialog('collect', booking)}
                              title="Đã thu tiền"
                              type="button"
                            >
                              <ActionIcon type="cash" />
                            </button>
                          )}
                          {canUndoPayment && (
                            <button
                              aria-label="Hoàn tác thu tiền"
                              className="admin-bookings-action-btn"
                              disabled={isProcessing}
                              onClick={() => openActionDialog('undo', booking)}
                              title="Hoàn tác thu tiền"
                              type="button"
                            >
                              <ActionIcon type="undo" />
                            </button>
                          )}
                          {canCancel && (
                            <button
                              aria-label="Hủy vé"
                              className="admin-bookings-action-btn"
                              disabled={isProcessing}
                              onClick={() => openActionDialog('cancel', booking)}
                              title="Hủy vé"
                              type="button"
                            >
                              <ActionIcon type="cancel" />
                            </button>
                          )}
                          {canDelete && (
                            <Link
                              aria-label="Xóa vé"
                              className="admin-bookings-action-btn"
                              title="Xóa vé"
                              to={`/admin/ve-xe/${booking.bookingCode}/xoa`}
                            >
                              <ActionIcon type="trash" />
                            </Link>
                          )}
                          {canMarkNoShow && (
                            <button
                              aria-label="Khách không đi"
                              className="admin-bookings-action-btn"
                              disabled={isProcessing}
                              onClick={() => openActionDialog('no-show', booking)}
                              title="Khách không đi"
                              type="button"
                            >
                              <ActionIcon type="no-show" />
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
            <div className="admin-bookings-pagination">
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

      {actionDialog && (() => {
        const content = getActionDialogContent()
        const booking = actionDialog.booking
        if (!content || !booking) return null

        return (
          <div className="admin-bookings-modal-backdrop" role="presentation" onMouseDown={closeActionDialog}>
            <section
              aria-labelledby="booking-action-dialog-title"
              aria-modal="true"
              className={`admin-bookings-modal is-${content.tone}`}
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="admin-bookings-modal__heading">
                <div>
                  <h3 id="booking-action-dialog-title">{content.title}</h3>
                  <p>{content.description}</p>
                </div>
                <button aria-label="Đóng" disabled={Boolean(processingCode)} onClick={closeActionDialog} type="button">×</button>
              </div>

              <div className="admin-bookings-modal__summary">
                <div><span>Mã vé</span><strong>{formatBookingCode(booking.bookingCode)}</strong></div>
                <div><span>Mã giao dịch</span><strong>{content.payment?.transactionCode || booking.transactionCode || '—'}</strong></div>
                <div><span>Khách hàng</span><strong>{booking.passengerFullName || 'Chưa cập nhật'}</strong></div>
                <div><span>Ghế/Phòng</span><strong>{content.seatCodes}</strong></div>
                <div><span>Phương thức</span><strong>{getPaymentMethodLabel(content.payment?.paymentMethod)}</strong></div>
                <div><span>Số tiền</span><strong>{formatCurrency(booking.totalAmount ?? 0)}</strong></div>
              </div>

              {actionDialog.type === 'collect' ? (
                <label className="admin-bookings-confirm-check">
                  <input
                    checked={actionDialog.confirmed}
                    onChange={(event) => updateActionDialog({ confirmed: event.target.checked })}
                    type="checkbox"
                  />
                  <span>Tôi xác nhận đã nhận đủ tiền từ khách.</span>
                </label>
              ) : (
                <label className="admin-bookings-reason-field">
                  <span>{content.reasonLabel}</span>
                  <textarea
                    autoFocus
                    maxLength={500}
                    onChange={(event) => updateActionDialog({ reason: event.target.value })}
                    placeholder="Nhập từ 5 đến 500 ký tự"
                    rows={4}
                    value={actionDialog.reason}
                  />
                  <small>{actionDialog.reason.trim().length}/500 ký tự</small>
                </label>
              )}

              <div className="admin-bookings-modal__actions">
                <button className="btn btn-outline-secondary" disabled={Boolean(processingCode)} onClick={closeActionDialog} type="button">Đóng</button>
                <button
                  className={`btn ${content.tone === 'success' ? 'btn-success' : content.tone === 'warning' ? 'btn-warning' : 'btn-danger'}`}
                  disabled={
                    Boolean(processingCode) ||
                    (actionDialog.type === 'collect'
                      ? !actionDialog.confirmed
                      : actionDialog.reason.trim().length < 5)
                  }
                  onClick={executeActionDialog}
                  type="button"
                >
                  {processingCode ? 'Đang xử lý...' : content.confirmLabel}
                </button>
              </div>
            </section>
          </div>
        )
      })()}

    </div>
  )
}

export default AdminBookingsPage
