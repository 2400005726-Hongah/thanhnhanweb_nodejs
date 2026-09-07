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
import {
  getTripPassengers,
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
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../../utils/paymentLabels.js'

import {
  formatLicensePlate,
} from '../../utils/normalizers.js'

import './AdminTripPassengersPage.css'

const SOURCE_LABELS = {
  ONLINE: 'Online',
  HOTLINE: 'Hotline',
  COUNTER: 'Tại quầy',
}

const displayDateTime = (value) =>
  value
    ? formatDateTime(value)
    : '—'

const getSeatCodes = (passenger) =>
  passenger.seats
    ?.map((seat) => seat.seatCode)
    .filter(Boolean)
    .join(', ') || '—'

const displayPickupPoint = (passenger) =>
  passenger.pickupRequestedAddress ||
  passenger.pickupPoint ||
  'Chưa xác định'

const displayDropoffPoint = (passenger) =>
  passenger.dropoffRequestedAddress ||
  passenger.dropoffPoint ||
  'Chưa xác định'

const escapeCsvValue = (value) => {
  const normalized =
    value === null ||
    value === undefined
      ? ''
      : String(value)

  return `"${normalized.replace(/"/g, '""')}"`
}

const buildCsvRow = (values) =>
  values.map(escapeCsvValue).join(';')

const getFileDate = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'khong-ro-ngay'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const sanitizeFileName = (value) =>
  String(value || 'chua-co-bien-so')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')

const getTripPrintCode = (trip) => {
  const value =
    trip?.tripCode ||
    trip?.code ||
    trip?.id ||
    ''

  if (!value) return '—'

  return String(value)
    .replace(/^#/, '')
    .slice(0, 8)
    .toUpperCase()
}

function AdminTripPassengersPage() {
  const { tripId } = useParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result =
        await getTripPassengers(tripId)

      setData(result)
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

  const printList = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print()
      })
    })
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
      finance,
      passengers = [],
    } = data

    const canViewFinance =
      Boolean(finance)

    const rows = [
      buildCsvRow(['NHÀ XE THÀNH NHÂN']),
      buildCsvRow([
        `DANH SÁCH HÀNH KHÁCH CHUYẾN #${getTripPrintCode(trip)}`,
      ]),
      buildCsvRow([
        'Tuyến',
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
        `${trip.bus?.licensePlate || 'Chưa cập nhật'} - ${getBusTypeLabel(trip.bus?.busType)}`,
      ]),
      buildCsvRow([
        'Tổng số vé',
        summary?.totalBookings ?? 0,
      ]),
      buildCsvRow([
        'Vé hiệu lực',
        summary?.validBookings ?? 0,
      ]),
      buildCsvRow([
        'Ghế đã đặt',
        `${summary?.bookedSeats ?? 0}/${summary?.capacity ?? 0}`,
      ]),
    ]

    if (canViewFinance) {
      rows.push(
        buildCsvRow([
          'Doanh thu đã thu',
          finance.collectedRevenue ?? 0,
        ]),
      )
    }

    rows.push('')

    const headers = [
      'STT',
      'Mã vé',
      'Khách hàng',
      'Liên hệ',
      'Ghế',
      'Điểm đón',
      'Điểm trả',
      'Nguồn đặt',
      'Ngày đặt',
      'Thanh toán',
    ]

    if (canViewFinance) {
      headers.splice(
        9,
        0,
        'Tổng tiền',
      )
    }

    rows.push(buildCsvRow(headers))

    passengers.forEach(
      (passenger, index) => {
        const row = [
          passenger.orderNumber ??
            index + 1,
          passenger.bookingCode || '',
          passenger.passengerFullName ||
            'Chưa cập nhật',
          [
            passenger.passengerPhone ||
              'Chưa cập nhật',
            passenger.passengerEmail || '',
          ]
            .filter(Boolean)
            .join(' - '),
          getSeatCodes(passenger),
          displayPickupPoint(passenger),
          displayDropoffPoint(passenger),
          SOURCE_LABELS[
            passenger.source
          ] ||
            passenger.source ||
            'Chưa xác định',
          displayDateTime(
            passenger.createdAt,
          ),
          `${getPaymentStatusLabel(passenger.paymentStatus)} - ${getPaymentMethodLabel(passenger.payment?.paymentMethod)}`,
        ]

        if (canViewFinance) {
          row.splice(
            9,
            0,
            passenger.totalAmount ?? 0,
          )
        }

        rows.push(buildCsvRow(row))
      },
    )

    const csvContent =
      `\uFEFF${rows.join('\r\n')}`

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
        trip.bus?.licensePlate,
      )

    const departureDate =
      getFileDate(
        trip.departureTime,
      )

    downloadLink.href = fileUrl
    downloadLink.download =
      `Danh-sach-hanh-khach_${licensePlate}_${departureDate}.csv`

    document.body.appendChild(
      downloadLink,
    )

    downloadLink.click()
    downloadLink.remove()

    URL.revokeObjectURL(fileUrl)
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
    finance,
    passengers = [],
  } = data

  const canViewFinance =
    Boolean(finance)

  return (
    <>
      <div className="passenger-list-no-print">
        <AdminPageHeader
          title="Danh sách hành khách"
          description="Danh sách hành khách theo chuyến, dùng để kiểm tra, xuất Excel và in bàn giao."
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
                  passengers.length === 0
                }
                onClick={exportExcel}
                type="button"
              >
                Xuất Excel
              </button>

              <button
                className="btn btn-primary"
                disabled={
                  passengers.length === 0
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
        <header className="passenger-print-header">
          <h1>NHÀ XE THÀNH NHÂN</h1>

          <h2>
            DANH SÁCH HÀNH KHÁCH CHUYẾN #{getTripPrintCode(trip)}
          </h2>

          <p>
            Tuyến:{' '}
            <strong className="route-name">
              {trip.route?.routeName ||
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
        </header>

        <div className="passenger-print-summary">
          <div>
            <span>Tổng số vé</span>
            <strong>
              {summary?.totalBookings ?? 0}
            </strong>
          </div>

          <div>
            <span>Vé hiệu lực</span>
            <strong>
              {summary?.validBookings ?? 0}
            </strong>
          </div>

          <div>
            <span>Ghế đã đặt</span>
            <strong>
              {summary?.bookedSeats ?? 0}
              {' / '}
              {summary?.capacity ?? 0}
            </strong>
          </div>

          {canViewFinance && (
            <div>
              <span>Doanh thu đã thu</span>
              <strong>
                {formatCurrency(
                  finance.collectedRevenue,
                )}
              </strong>
            </div>
          )}
        </div>

        {passengers.length === 0 ? (
          <div className="passenger-print-empty">
            Chuyến xe chưa có hành khách.
          </div>
        ) : (
          <div className="passenger-print-table-wrap">
            <table className="passenger-print-table">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                {canViewFinance && (
                  <col style={{ width: '9%' }} />
                )}
                <col style={{ width: '10%' }} />
              </colgroup>

              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã vé</th>
                  <th>Khách hàng</th>
                  <th>Liên hệ</th>
                  <th>Ghế</th>
                  <th>Điểm đón</th>
                  <th>Điểm trả</th>
                  <th>Nguồn đặt</th>
                  <th>Ngày đặt</th>

                  {canViewFinance && (
                    <th>Tổng tiền</th>
                  )}

                  <th>Thanh toán</th>
                </tr>
              </thead>

              <tbody>
                {passengers.map(
                  (
                    passenger,
                    index,
                  ) => (
                    <tr key={passenger.id}>
                      <td>
                        {passenger.orderNumber ??
                          index + 1}
                      </td>

                      <td>
                        <strong>
                          {passenger.bookingCode ||
                            '—'}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {passenger.passengerFullName ||
                            'Chưa cập nhật'}
                        </strong>
                      </td>

                      <td>
                        <span>
                          {passenger.passengerPhone ||
                            'Chưa cập nhật'}
                        </span>

                        {passenger.passengerEmail && (
                          <small>
                            {passenger.passengerEmail}
                          </small>
                        )}
                      </td>

                      <td>
                        <span className="seat-code-print">
                          {getSeatCodes(passenger)}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {displayPickupPoint(
                            passenger,
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {displayDropoffPoint(
                            passenger,
                          )}
                        </strong>
                      </td>

                      <td>
                        {SOURCE_LABELS[
                          passenger.source
                        ] ||
                          passenger.source ||
                          'Chưa xác định'}
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
                        <span className="payment-status-print">
                          {getPaymentStatusLabel(
                            passenger.paymentStatus,
                          )}
                        </span>

                        <small>
                          {getPaymentMethodLabel(
                            passenger.payment
                              ?.paymentMethod,
                          )}
                        </small>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="passenger-print-signatures">
          <div>
            <strong>
              Nhân viên lập danh sách
            </strong>
            <span>Ký và ghi rõ họ tên</span>
          </div>

          <div>
            <strong>
              Tài xế / Phụ xe xác nhận
            </strong>
            <span>Ký và ghi rõ họ tên</span>
          </div>
        </footer>
      </section>
    </>
  )
}

export default AdminTripPassengersPage
