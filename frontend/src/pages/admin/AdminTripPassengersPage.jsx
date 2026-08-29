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
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/common/StatusState.jsx'
import {
  collectBookingPayment,
  getTripPassengers,
  markNoShow,
  undoBookingPayment,
} from '../../services/admin.service.js'
import {
  getApiErrorMessage,
} from '../../services/apiClient.js'
import {
  getBusTypeLabel,
} from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import {
  formatDateTime,
} from '../../utils/formatDateTime.js'
import { formatLicensePlate, formatPhoneInput, normalizeLicensePlate } from '../../utils/normalizers.js'
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

const SERVICE_MODE_LABELS = {
  TaiVanPhong: 'Tại văn phòng nhà xe',
  DonTaiBenXe: 'Đón trực tiếp tại bến xe trung tâm',
  DonTaiDiemHen: 'Đón tại điểm hẹn',
  TrungChuyenDonKhach: 'Xe trung chuyển đón khách',
  TraTaiBenXe: 'Trả khách tại bến xe trung tâm đích đến',
  TraTaiVanPhong: 'Trả khách tại văn phòng nhà xe',
  TraTaiDiemDung: 'Trả khách tại điểm dừng',
  TrungChuyenTraKhach: 'Xe trung chuyển trả tận nơi khu vực nội thành',
}

const getServiceModeLabel = (value) =>
  SERVICE_MODE_LABELS[value] || value || 'Chưa xác định'

const displayDateTime = (value) =>
  value
    ? formatDateTime(value)
    : '—'

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

const getSeatCodes = (passenger) =>
  passenger.seats
    ?.map(
      (seat) => seat.seatCode,
    )
    .filter(Boolean)
    .join(', ') || '—'

const getPassengerNote = (passenger) =>
  passenger.staffNote ||
  passenger.customerNote ||
  passenger.cancellationReason ||
  passenger.noShowReason ||
  passenger.deletedReason ||
  'Không có'

const hasDepartureTimePassed = (
  departureTime,
) => {
  const departureTimestamp =
    new Date(
      departureTime,
    ).getTime()

  return (
    Number.isFinite(
      departureTimestamp,
    ) &&
    Date.now() >=
      departureTimestamp
  )
}

const escapeCsvValue = (value) => {
  const normalized =
    value === null ||
    value === undefined
      ? ''
      : String(value)

  return `"${normalized.replace(
    /"/g,
    '""',
  )}"`
}

const buildCsvRow = (values) =>
  values
    .map(escapeCsvValue)
    .join(';')

const getFileDate = (value) => {
  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'khong-ro-ngay'
  }

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0')

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const sanitizeFileName = (value) =>
  String(
    value ||
      'chua-co-bien-so',
  )
    .trim()
    .replace(
      /[<>:"/\\|?*]/g,
      '-',
    )
    .replace(/\s+/g, '-')

function AdminTripPassengersPage() {
  const { tripId } =
    useParams()

  const { user } = useAuth()

  const [data, setData] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [
    processingBookingCode,
    setProcessingBookingCode,
  ] = useState('')

  const load = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const result =
          await getTripPassengers(
            tripId,
          )

        setData(result)
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
    [tripId],
  )

  useEffect(() => {
    load()
  }, [load])

  const printList = () => {
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

  const handleMarkNoShow = async (
    passenger,
  ) => {
    const reason =
      window.prompt(
        `Nhập lý do khách không đi cho vé ${passenger.bookingCode}:`,
      )

    if (reason === null) {
      return
    }

    const normalizedReason =
      reason.trim()

    if (
      normalizedReason.length < 5 ||
      normalizedReason.length > 500
    ) {
      window.alert(
        'Lý do khách không đi phải từ 5 đến 500 ký tự.',
      )
      return
    }

    const confirmed =
      window.confirm(
        `Xác nhận hành khách của vé ${passenger.bookingCode} không đi?\n\nTrạng thái thanh toán sẽ được giữ nguyên.`,
      )

    if (!confirmed) {
      return
    }

    setProcessingBookingCode(
      passenger.bookingCode,
    )

    try {
      await markNoShow(
        passenger.bookingCode,
        normalizedReason,
      )

      window.alert(
        'Đã đánh dấu khách không đi.',
      )

      await load()
    } catch (requestError) {
      window.alert(
        getApiErrorMessage(
          requestError,
        ),
      )
    } finally {
      setProcessingBookingCode('')
    }
  }

  const handleCollectPayment = async (passenger) => {
    const confirmed = window.confirm(
      `Xác nhận đã nhận đủ ${formatCurrency(passenger.totalAmount ?? 0)} từ khách của vé ${passenger.bookingCode}?`,
    )

    if (!confirmed) return

    setProcessingBookingCode(passenger.bookingCode)
    try {
      await collectBookingPayment(passenger.bookingCode)
      window.alert('Đã xác nhận thu tiền của vé.')
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingBookingCode('')
    }
  }

  const handleUndoPayment = async (passenger) => {
    const reason = window.prompt(
      `Nhập lý do hoàn tác xác nhận thu tiền cho vé ${passenger.bookingCode}:`,
    )

    if (reason === null) return
    const normalizedReason = reason.trim()
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      window.alert('Lý do hoàn tác phải có từ 5 đến 500 ký tự.')
      return
    }

    if (!window.confirm('Xác nhận đưa thanh toán của vé về Chưa thanh toán?')) return

    setProcessingBookingCode(passenger.bookingCode)
    try {
      await undoBookingPayment(passenger.bookingCode, normalizedReason)
      window.alert('Đã hoàn tác xác nhận thu tiền.')
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingBookingCode('')
    }
  }

  const exportExcel = () => {
    if (!data?.trip) {
      window.alert(
        'Không có dữ liệu chuyến xe để xuất.',
      )
      return
    }

    const {
      trip,
      summary,
      serviceSummary,
      finance,
      passengers = [],
    } = data

    const canViewFinance =
      Boolean(finance)

    const rows = [
      buildCsvRow([
        'NHÀ XE THÀNH NHÂN',
      ]),

      buildCsvRow([
        'DANH SÁCH HÀNH KHÁCH',
      ]),

      buildCsvRow([
        'Tuyến đường',
        trip.route?.routeName ||
          'Chưa xác định',
      ]),

      buildCsvRow([
        'Khởi hành',
        displayDateTime(
          trip.departureTime,
        ),
      ]),

      buildCsvRow([
        'Xe',
        trip.bus?.busName ||
          'Chưa cập nhật',
      ]),

      buildCsvRow([
        'Biển số',
        (trip.bus?.licensePlate ? formatLicensePlate(trip.bus.licensePlate) : '') ||
          'Chưa cập nhật',
      ]),

      buildCsvRow([
        'Loại xe',
        getBusTypeLabel(
          trip.bus?.busType,
        ),
      ]),

      buildCsvRow([
        'Tổng số vé',
        summary?.totalBookings ??
          0,
      ]),

      buildCsvRow([
        'Vé hiệu lực',
        summary?.validBookings ??
          0,
      ]),

      buildCsvRow([
        'Ghế đã đặt',
        `${summary?.bookedSeats ?? 0}/${summary?.capacity ?? 0}`,
      ]),
      buildCsvRow([
        'Khách cần trung chuyển đón',
        serviceSummary?.pickupTransferCount ?? 0,
      ]),
      buildCsvRow([
        'Khách cần trung chuyển trả',
        serviceSummary?.dropoffTransferCount ?? 0,
      ]),
    ]

    if (canViewFinance) {
      rows.push(
        buildCsvRow([
          'Doanh thu đã thu',
          finance.collectedRevenue ??
            0,
        ]),
      )
    }

    rows.push('')

    const headers = [
      'STT',
      'Mã vé',
      'Họ tên hành khách',
      'Số điện thoại',
      'Email',
      'Ghế',
      'Nguồn đặt',
      'Điểm đón chi tiết',
      'Hình thức đón',
      'Điểm trả chi tiết',
      'Hình thức trả',
      'Ngày đặt',
      'Trạng thái thanh toán',
      'Phương thức thanh toán',
      'Trạng thái vé',
      'Ghi chú',
    ]

    if (canViewFinance) {
      headers.splice(
        12,
        0,
        'Tổng tiền',
      )
    }

    rows.push(
      buildCsvRow(headers),
    )

    passengers.forEach(
      (passenger, index) => {
        const passengerRow = [
          passenger.orderNumber ??
            index + 1,

          passenger.bookingCode ||
            '',

          passenger.passengerFullName ||
            'Chưa cập nhật',

          (passenger.passengerPhone ? formatPhoneInput(passenger.passengerPhone) : '') ||
            'Chưa cập nhật',

          passenger.passengerEmail ||
            '',

          getSeatCodes(
            passenger,
          ),

          SOURCE_LABELS[
            passenger.source
          ] ||
            'Chưa xác định',

          passenger.pickupPoint || '',

          getServiceModeLabel(passenger.pickupServiceMode),

          passenger.dropoffPoint || '',

          getServiceModeLabel(passenger.dropoffServiceMode),

          displayDateTime(
            passenger.createdAt,
          ),

          getPaymentStatusLabel(
            passenger.paymentStatus,
          ),

          getPaymentMethodLabel(
            passenger.payment
              ?.paymentMethod,
          ),

          BOOKING_STATUS_LABELS[
            passenger.status
          ] ||
            passenger.status ||
            '',

          getPassengerNote(
            passenger,
          ),
        ]

        if (canViewFinance) {
          passengerRow.splice(
            12,
            0,
            passenger.totalAmount ??
              0,
          )
        }

        rows.push(
          buildCsvRow(
            passengerRow,
          ),
        )
      },
    )

    const csvContent =
      `\uFEFF${rows.join(
        '\r\n',
      )}`

    const file = new Blob(
      [csvContent],
      {
        type:
          'text/csv;charset=utf-8;',
      },
    )

    const fileUrl =
      URL.createObjectURL(file)

    const downloadLink =
      document.createElement('a')

    const licensePlate =
      sanitizeFileName(
        normalizeLicensePlate(trip.bus?.licensePlate) || 'XE',
      )

    const departureDate =
      getFileDate(
        trip.departureTime,
      )

    downloadLink.href =
      fileUrl

    downloadLink.download =
      `Danh-sach-hanh-khach_${licensePlate}_${departureDate}.csv`

    document.body.appendChild(
      downloadLink,
    )

    downloadLink.click()
    downloadLink.remove()

    URL.revokeObjectURL(
      fileUrl,
    )
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

  if (!data?.trip) {
    return (
      <EmptyState message="Không tìm thấy chuyến xe." />
    )
  }

  const {
    trip,
    summary,
    serviceSummary,
    finance,
    passengers = [],
  } = data

  const canViewFinance =
    Boolean(finance)

  const tripHasDeparted =
    hasDepartureTimePassed(
      trip.departureTime,
    )

  return (
    <>
      <div className="passenger-list-no-print">
        <AdminPageHeader
          title="Danh sách hành khách"
          description="Danh sách khách và vé theo từng chuyến xe."
          actions={
            <>
              <Link
                className="btn btn-outline-secondary"
                to="/admin/chuyen-xe"
              >
                ← Quay lại
              </Link>

              <button
                className="btn btn-outline-success"
                disabled={
                  passengers.length ===
                  0
                }
                onClick={exportExcel}
                type="button"
              >
                Xuất Excel
              </button>

              <button
                className="btn btn-primary"
                disabled={
                  passengers.length ===
                  0
                }
                onClick={printList}
                type="button"
              >
                In danh sách
              </button>
            </>
          }
        />
      </div>

      <section className="passenger-list-print">
        <header className="passenger-list-header">
          <h1>
            NHÀ XE THÀNH NHÂN
          </h1>

          <h2>
            DANH SÁCH HÀNH KHÁCH
          </h2>

          <p>
            Tuyến:{' '}
            <strong>
              {trip.route
                ?.routeName ||
                'Chưa xác định'}
            </strong>
          </p>

          <p>
            Khởi hành:{' '}
            <strong>
              {displayDateTime(
                trip.departureTime,
              )}
            </strong>
          </p>

          <p>
            Xe:{' '}
            <strong>
              {trip.bus?.licensePlate
                ? formatLicensePlate(trip.bus.licensePlate)
                : 'Chưa cập nhật'}
              {' - '}
              {getBusTypeLabel(
                trip.bus?.busType,
              )}
            </strong>
          </p>

          <p>
            Trạng thái:{' '}
            <strong>
              {trip.status ||
                'Chưa xác định'}
            </strong>
          </p>
        </header>

        <div className="admin-stat-grid passenger-list-summary">
          <article className="admin-stat-card">
            <span>
              Tổng số vé
            </span>

            <strong>
              {summary
                ?.totalBookings ??
                0}
            </strong>
          </article>

          <article className="admin-stat-card">
            <span>
              Vé hiệu lực
            </span>

            <strong>
              {summary
                ?.validBookings ??
                0}
            </strong>
          </article>

          <article className="admin-stat-card">
            <span>
              Ghế đã đặt
            </span>

            <strong>
              {summary
                ?.bookedSeats ??
                0}
              {' / '}
              {summary?.capacity ??
                0}
            </strong>
          </article>

          {canViewFinance && (
            <article className="admin-stat-card">
              <span>
                Doanh thu đã thu
              </span>

              <strong>
                {formatCurrency(
                  finance
                    .collectedRevenue,
                )}
              </strong>
            </article>
          )}
        </div>

        <div className="passenger-service-summary passenger-list-no-print">
          <section>
            <div className="passenger-service-summary__heading">
              <strong>Nhóm theo điểm đón</strong>
              <span>Trung chuyển: {serviceSummary?.pickupTransferCount ?? 0} khách</span>
            </div>
            <div className="passenger-service-summary__groups">
              {(serviceSummary?.pickupGroups || []).length ? (
                serviceSummary.pickupGroups.map((group) => (
                  <div key={`${group.point}-${group.serviceMode || ''}`}>
                    <strong>{group.point}</strong>
                    <small>{getServiceModeLabel(group.serviceMode)}</small>
                    <b>{group.count} khách</b>
                  </div>
                ))
              ) : (
                <small>Chưa có dữ liệu điểm đón.</small>
              )}
            </div>
          </section>
          <section>
            <div className="passenger-service-summary__heading">
              <strong>Nhóm theo điểm trả</strong>
              <span>Trung chuyển: {serviceSummary?.dropoffTransferCount ?? 0} khách</span>
            </div>
            <div className="passenger-service-summary__groups">
              {(serviceSummary?.dropoffGroups || []).length ? (
                serviceSummary.dropoffGroups.map((group) => (
                  <div key={`${group.point}-${group.serviceMode || ''}`}>
                    <strong>{group.point}</strong>
                    <small>{getServiceModeLabel(group.serviceMode)}</small>
                    <b>{group.count} khách</b>
                  </div>
                ))
              ) : (
                <small>Chưa có dữ liệu điểm trả.</small>
              )}
            </div>
          </section>
        </div>

        {!tripHasDeparted && (
          <div className="alert alert-info passenger-list-no-print">
            Chức năng “Khách không
            đi” chỉ sử dụng sau giờ
            khởi hành của chuyến.
          </div>
        )}

        <section className="admin-panel passenger-list-panel">
          {passengers.length ===
          0 ? (
            <EmptyState message="Chuyến xe chưa có hành khách." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table passenger-list-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã vé</th>
                    <th>Khách hàng</th>
                    <th>Liên hệ</th>
                    <th>Ghế</th>
                    <th>Nguồn đặt</th>
                    <th>Điểm đón/trả</th>
                    <th>Ngày đặt</th>

                    {canViewFinance && (
                      <th>
                        Tổng tiền
                      </th>
                    )}

                    <th>
                      Thanh toán
                    </th>

                    <th>
                      Trạng thái vé
                    </th>

                    <th>
                      Ghi chú
                    </th>

                    <th className="passenger-list-no-print">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {passengers.map(
                    (
                      passenger,
                      index,
                    ) => {
                      const seatCodes =
                        getSeatCodes(
                          passenger,
                        )

                      const note =
                        getPassengerNote(
                          passenger,
                        )

                      const canMarkNoShow =
                        tripHasDeparted &&
                        passenger.status ===
                          'CONFIRMED'

                      const canCollectPayment =
                        passenger.status === 'CONFIRMED' &&
                        passenger.payment?.paymentMethod === 'PAY_AT_BUS' &&
                        passenger.payment?.status === 'PENDING'

                      const canUndoPayment =
                        user?.role === 'ADMIN' &&
                        passenger.status === 'CONFIRMED' &&
                        passenger.payment?.paymentMethod === 'PAY_AT_BUS' &&
                        passenger.payment?.status === 'SUCCESS'

                      const isProcessing =
                        processingBookingCode ===
                        passenger.bookingCode

                      return (
                        <tr
                          key={
                            passenger.id ||
                            passenger.bookingCode
                          }
                        >
                          <td>
                            {passenger.orderNumber ??
                              index + 1}
                          </td>

                          <td>
                            <strong>
                              {
                                passenger.bookingCode
                              }
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {passenger.passengerFullName ||
                                'Chưa cập nhật'}
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {(passenger.passengerPhone ? formatPhoneInput(passenger.passengerPhone) : '') ||
                                'Chưa cập nhật'}
                            </strong>

                            <small>
                              {passenger.passengerEmail ||
                                'Chưa có email'}
                            </small>
                          </td>

                          <td>
                            <strong>
                              {seatCodes}
                            </strong>
                          </td>

                          <td>
                            {SOURCE_LABELS[
                              passenger.source
                            ] ||
                              'Chưa xác định'}
                          </td>

                          <td>
                            <strong>
                              Đón: {passenger.pickupPoint || 'Chưa xác định'}
                            </strong>
                            <small>
                              {getServiceModeLabel(passenger.pickupServiceMode)}
                            </small>
                            <strong className="mt-1">
                              Trả: {passenger.dropoffPoint || 'Chưa xác định'}
                            </strong>
                            <small>
                              {getServiceModeLabel(passenger.dropoffServiceMode)}
                            </small>
                          </td>

                          <td>
                            {displayDateTime(
                              passenger.createdAt,
                            )}
                          </td>

                          {canViewFinance && (
                            <td>
                              <strong>
                                {formatCurrency(
                                  passenger.totalAmount ??
                                    0,
                                )}
                              </strong>
                            </td>
                          )}

                          <td>
                            <strong>
                              {getPaymentStatusLabel(
                                passenger.paymentStatus,
                              )}
                            </strong>

                            <small>
                              {getPaymentMethodLabel(
                                passenger
                                  .payment
                                  ?.paymentMethod,
                              )}
                            </small>
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                passenger.status,
                              )}
                            >
                              {BOOKING_STATUS_LABELS[
                                passenger.status
                              ] ||
                                passenger.status ||
                                'Chưa xác định'}
                            </span>
                          </td>

                          <td>
                            {note}
                          </td>

                          <td className="passenger-list-no-print">
                            <div className="admin-row-actions">
                              <Link
                                to={`/admin/ve-xe/${passenger.bookingCode}`}
                              >
                                Chi tiết vé
                              </Link>

                              {canCollectPayment && (
                                <button
                                  disabled={isProcessing}
                                  onClick={() => handleCollectPayment(passenger)}
                                  type="button"
                                >
                                  {isProcessing ? 'Đang xử lý...' : 'Đã thu tiền'}
                                </button>
                              )}

                              {canUndoPayment && (
                                <button
                                  disabled={isProcessing}
                                  onClick={() => handleUndoPayment(passenger)}
                                  type="button"
                                >
                                  {isProcessing ? 'Đang xử lý...' : 'Hoàn tác thu tiền'}
                                </button>
                              )}

                              {canMarkNoShow && (
                                <button
                                  className="is-danger"
                                  disabled={
                                    isProcessing
                                  }
                                  onClick={() =>
                                    handleMarkNoShow(
                                      passenger,
                                    )
                                  }
                                  type="button"
                                >
                                  {isProcessing
                                    ? 'Đang xử lý...'
                                    : 'Khách không đi'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="passenger-list-signatures">
          <div>
            <strong>
              Nhân viên lập danh sách
            </strong>

            <span>
              Ký và ghi rõ họ tên
            </span>
          </div>

          <div>
            <strong>
              Tài xế / Phụ xe xác nhận
            </strong>

            <span>
              Ký và ghi rõ họ tên
            </span>
          </div>
        </footer>
      </section>
    </>
  )
}

export default AdminTripPassengersPage