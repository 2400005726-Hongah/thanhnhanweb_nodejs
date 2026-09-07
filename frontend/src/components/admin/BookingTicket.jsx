const PAYMENT_STATUS_LABELS = {
  PENDING: 'Chưa thanh toán',
  SUCCESS: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
}

const PAYMENT_METHOD_LABELS = {
  VNPAY: 'VNPay',
  MOMO: 'Ví MoMo',
  ZALOPAY: 'ZaloPay',
  BANK_QR: 'QR ngân hàng',
  QR_BANK: 'QR ngân hàng',
  BANK_TRANSFER: 'Chuyển khoản',
  PAY_AT_BUS: 'Thanh toán tại xe',
  CASH: 'Tiền mặt',
}

const BUS_TYPE_LABELS = {
  SLEEPER_34: 'Giường nằm 34 giường',
  LIMOUSINE_22: 'Limousine 22 phòng',
}

const toDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDeparture = (value) => {
  const date = toDate(value)
  if (!date) return 'Chưa cập nhật'

  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  const weekday = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][date.getDay()]

  return `${get('hour')}:${get('minute')} ${weekday}, ${get('day')}/${get('month')}/${get('year')}`
}

const formatMoney = (value) => {
  const amount = Number(value || 0)
  return `${new Intl.NumberFormat('vi-VN').format(Number.isFinite(amount) ? amount : 0)} đ`
}

const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return value || 'Chưa cập nhật'
}

const formatLicensePlate = (value) => {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^\d{2}[A-Z]\d{5}$/.test(raw)) {
    return `${raw.slice(0, 3)}-${raw.slice(3, 6)}.${raw.slice(6)}`
  }
  return value || 'Chưa cập nhật'
}

const textOf = (value, fallback = 'Chưa cập nhật') => {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value.name || value.address || value.label || fallback
}

const getTripEndpoints = (booking) => {
  const trip = booking?.trip || {}
  const routeName = trip.route?.routeName || ''

  const departure =
    textOf(trip.departureLocation, '') ||
    textOf(trip.route?.departureLocation, '') ||
    routeName.split('→')[0]?.trim() ||
    'Chưa cập nhật'

  const arrival =
    textOf(trip.arrivalLocation, '') ||
    textOf(trip.route?.arrivalLocation, '') ||
    routeName.split('→')[1]?.trim() ||
    'Chưa cập nhật'

  return { departure, arrival }
}

const getPickupPoint = (booking, fallback) =>
  textOf(
    booking?.pickupPoint ||
      booking?.pickupLocation ||
      booking?.pickupServicePoint ||
      booking?.pickupStop,
    fallback,
  )

const getDropoffPoint = (booking, fallback) =>
  textOf(
    booking?.dropoffPoint ||
      booking?.dropoffLocation ||
      booking?.dropoffServicePoint ||
      booking?.dropoffStop,
    fallback,
  )

const TicketLogo = () => (
  <svg
    aria-hidden="true"
    className="k80-logo"
    viewBox="0 0 100 100"
  >
    <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="5" />
    <path d="M18 33c20-19 47-22 67-10" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <path d="M18 68c18 17 45 21 67 8" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    <text
      x="50"
      y="62"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      fontWeight="900"
      fontStyle="italic"
      fontSize="42"
    >
      TN
    </text>
  </svg>
)

const BusIcon = () => (
  <svg
    aria-hidden="true"
    className="k80-bus-icon"
    viewBox="0 0 64 64"
  >
    <rect x="14" y="8" width="36" height="44" rx="8" fill="currentColor" />
    <rect x="19" y="14" width="26" height="18" rx="2" fill="#fff" />
    <circle cx="23" cy="42" r="4" fill="#fff" />
    <circle cx="41" cy="42" r="4" fill="#fff" />
    <rect x="19" y="52" width="7" height="6" rx="2" fill="currentColor" />
    <rect x="38" y="52" width="7" height="6" rx="2" fill="currentColor" />
  </svg>
)

function BookingTicket({ booking }) {
  if (!booking) return null

  const payment = booking.payments?.[0] ?? booking.payment ?? null
  const { departure, arrival } = getTripEndpoints(booking)
  const trip = booking.trip || {}
  const bus = trip.bus || {}

  const bookingCode = String(booking.bookingCode || 'Chưa cập nhật').toUpperCase()
  const transactionCode =
    payment?.transactionCode ||
    booking.transactionCode ||
    bookingCode

  const pickupPoint = getPickupPoint(booking, departure)
  const dropoffPoint = getDropoffPoint(booking, arrival)

  const seatCodes =
    (booking.items || [])
      .map((item) => item?.seatCode)
      .filter(Boolean)
      .join(', ') || 'Chưa cập nhật'

  const busType =
    BUS_TYPE_LABELS[bus.busType] ||
    bus.busName ||
    'Chưa cập nhật'

  const plate = formatLicensePlate(bus.licensePlate)
  const busText =
    plate === 'Chưa cập nhật'
      ? busType
      : `${busType} - ${plate}`

  const paymentStatus =
    PAYMENT_STATUS_LABELS[payment?.status || booking.paymentStatus] ||
    'Chưa cập nhật'

  const paymentMethod =
    PAYMENT_METHOD_LABELS[payment?.paymentMethod] ||
    payment?.paymentMethod ||
    'Chưa cập nhật'

  const rows = [
    ['Mã giao dịch', transactionCode],
    ['Khách hàng', booking.passengerFullName || 'Chưa cập nhật'],
    ['Số điện thoại', formatPhone(booking.passengerPhone)],
    ['Hành trình', `${departure} → ${arrival}`],
    ['Điểm đón', pickupPoint],
    ['Điểm trả', dropoffPoint],
    ['Ngày giờ xuất bến', formatDeparture(trip.departureTime), 'strong'],
    ['Ghế/Phòng', seatCodes],
    ['Xe', busText],
    ['Thanh toán', paymentStatus],
    ['Phương thức', paymentMethod],
    ['Tổng tiền', formatMoney(booking.totalAmount), 'money'],
  ]

  return (
    <section className="k80-print-root" aria-label={`Vé ${bookingCode}`}>
      <style>{`
        @page{
          size:A5 portrait;
          margin:0;
        }

        html,body{
          margin:0!important;
          padding:0!important;
          background:#fff!important;
        }

        .admin-bookings-mvc-page > .k80-print-root{
          position:fixed!important;
          left:-100000px!important;
          top:0!important;
          width:148mm!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }

        .k80-print-root,
        .k80-print-root *{
          box-sizing:border-box;
          -webkit-print-color-adjust:exact!important;
          print-color-adjust:exact!important;
        }

        .k80-print-root{
          width:148mm;
          height:210mm;
          margin:0;
          padding:8mm;
          overflow:hidden;
          color:#050505;
          background:#fff;
          font-family:"Times New Roman",Times,serif;
        }

        .k80-ticket{
          width:100%;
          height:100%;
          border:.35mm solid #111;
          padding:7mm;
          display:flex;
          flex-direction:column;
          background:#fff;
        }

        .k80-brand{
          display:grid;
          grid-template-columns:17mm 1fr;
          column-gap:2.5mm;
          align-items:center;
          border-bottom:.28mm solid #111;
          padding-bottom:2.3mm;
        }

        .k80-logo{
          width:16mm;
          height:16mm;
          color:#000;
          display:block;
        }

        .k80-brand-copy{
          text-align:center;
          min-width:0;
        }

        .k80-brand-copy h1{
          margin:0;
          font-size:8.5mm;
          line-height:1;
          letter-spacing:.15mm;
          font-weight:900;
          white-space:nowrap;
        }

        .k80-route-brand{
          margin-top:1.4mm;
          display:flex;
          align-items:center;
          gap:1.7mm;
          font-size:4mm;
          line-height:1.15;
          font-weight:700;
          white-space:nowrap;
        }

        .k80-route-brand::before,
        .k80-route-brand::after{
          content:"";
          height:.28mm;
          background:#111;
          flex:1;
        }

        .k80-hotline{
          margin-top:1mm;
          font-size:4.6mm;
          font-weight:800;
        }

        .k80-slogan{
          display:flex;
          align-items:center;
          gap:1.8mm;
          margin:2.1mm 0 1.5mm;
          font-size:2.8mm;
          letter-spacing:.75mm;
          text-align:center;
          white-space:nowrap;
        }

        .k80-slogan::before,
        .k80-slogan::after{
          content:"";
          height:.24mm;
          background:#111;
          flex:1;
        }

        .k80-title{
          text-align:center;
          margin-top:.5mm;
        }

        .k80-title h2{
          margin:0;
          font-size:8.5mm;
          line-height:1;
          font-weight:900;
          letter-spacing:.4mm;
        }

        .k80-bus-line{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:3mm;
          margin-top:1.2mm;
        }

        .k80-bus-line::before,
        .k80-bus-line::after{
          content:"";
          width:18mm;
          height:.28mm;
          background:#111;
        }

        .k80-bus-icon{
          width:7mm;
          height:7mm;
          color:#000;
          display:block;
        }

        .k80-subtitle{
          margin-top:.6mm;
          text-align:center;
          font-size:2.7mm;
          letter-spacing:.7mm;
          white-space:nowrap;
        }

        .k80-code{
          display:grid;
          grid-template-columns:32mm 1fr;
          margin-top:2.1mm;
          border:.4mm solid #111;
          border-radius:1.7mm;
          min-height:13mm;
          overflow:hidden;
        }

        .k80-code-label,
        .k80-code-value{
          display:flex;
          align-items:center;
          justify-content:center;
          min-width:0;
        }

        .k80-code-label{
          border-right:.28mm solid #111;
          font-size:4.3mm;
          font-weight:900;
        }

        .k80-code-value{
          padding:1.1mm 1.5mm;
          font-family:Arial,sans-serif;
          font-size:5.2mm;
          line-height:1.1;
          font-weight:900;
          overflow-wrap:anywhere;
          text-align:center;
        }

        .k80-info{
          margin-top:2mm;
          border:.3mm solid #111;
          border-bottom:0;
        }

        .k80-row{
          display:grid;
          grid-template-columns:35mm minmax(0,1fr);
          min-height:8mm;
          border-bottom:.28mm solid #777;
        }

        .k80-row-label,
        .k80-row-value{
          display:flex;
          align-items:center;
          padding:1.15mm 1.7mm;
          min-width:0;
          line-height:1.12;
        }

        .k80-row-label{
          border-right:.28mm solid #777;
          font-size:3.6mm;
          font-weight:800;
        }

        .k80-row-value{
          font-family:Arial,sans-serif;
          font-size:3.3mm;
          overflow-wrap:anywhere;
        }

        .k80-row-value.is-strong{
          font-weight:900;
        }

        .k80-row-value.is-money{
          font-size:4.3mm;
          font-weight:900;
        }

        .k80-note{
          margin-top:auto;
          padding-top:2mm;
          border-top:.3mm dashed #111;
        }

        .k80-note-main{
          display:grid;
          grid-template-columns:10mm 1fr;
          align-items:center;
          gap:2mm;
          padding:1.5mm 2mm;
        }

        .k80-clock{
          width:8mm;
          height:8mm;
          border:.8mm solid #111;
          border-radius:50%;
          position:relative;
          justify-self:center;
        }

        .k80-clock::before{
          content:"";
          position:absolute;
          left:50%;
          top:1.3mm;
          width:.7mm;
          height:2.4mm;
          background:#111;
          transform:translateX(-50%);
        }

        .k80-clock::after{
          content:"";
          position:absolute;
          left:50%;
          top:50%;
          width:2.2mm;
          height:.7mm;
          background:#111;
          transform-origin:left center;
          transform:rotate(28deg);
        }

        .k80-note-main strong{
          font-size:3.3mm;
          line-height:1.22;
          text-align:center;
        }

        .k80-thanks{
          display:flex;
          align-items:center;
          gap:1.6mm;
          margin-top:1mm;
          font-size:2.2mm;
          letter-spacing:.35mm;
          text-align:center;
          white-space:nowrap;
        }

        .k80-thanks::before,
        .k80-thanks::after{
          content:"";
          height:.23mm;
          background:#111;
          flex:1;
        }

        @media print{
          html,body{
            width:148mm!important;
            height:210mm!important;
            margin:0!important;
            padding:0!important;
            overflow:hidden!important;
          }

          .k80-print-root{
            width:148mm!important;
            height:210mm!important;
            margin:0!important;
            padding:8mm!important;
            visibility:visible!important;
            position:static!important;
            overflow:hidden!important;
            page-break-after:avoid!important;
            break-after:avoid-page!important;
          }
        }
      `}</style>

      <article className="k80-ticket">
        <header>
          <div className="k80-brand">
            <TicketLogo />

            <div className="k80-brand-copy">
              <h1>NHÀ XE THÀNH NHÂN</h1>
              <div className="k80-route-brand">
                <span>Krông Năng - Buôn Hồ - Sài Gòn</span>
              </div>
              <div className="k80-hotline">
                Hotline: 0979.406.406
              </div>
            </div>
          </div>

          <div className="k80-slogan">
            <span>AN TOÀN · UY TÍN · ĐỒNG HÀNH CÙNG BẠN</span>
          </div>

          <div className="k80-title">
            <h2>VÉ ĐIỆN TỬ</h2>

            <div className="k80-bus-line">
              <BusIcon />
            </div>

            <div className="k80-subtitle">
              CHUYẾN ĐI AN TOÀN - HÀNH TRÌNH THUẬN LỢI
            </div>
          </div>
        </header>

        <section className="k80-code">
          <div className="k80-code-label">MÃ VÉ</div>
          <div className="k80-code-value">{bookingCode}</div>
        </section>

        <section className="k80-info">
          {rows.map(([label, value, tone]) => (
            <div className="k80-row" key={label}>
              <div className="k80-row-label">{label}</div>
              <div
                className={[
                  'k80-row-value',
                  tone === 'strong' ? 'is-strong' : '',
                  tone === 'money' ? 'is-money' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {value}
              </div>
            </div>
          ))}
        </section>

        <footer className="k80-note">
          <div className="k80-note-main">
            <span className="k80-clock" aria-hidden="true" />
            <strong>
              Vui lòng có mặt tại văn phòng nhà xe trước giờ xuất bến tối thiểu 30 phút.
            </strong>
          </div>

          <div className="k80-thanks">
            <span>CẢM ƠN QUÝ KHÁCH ĐÃ ĐỒNG HÀNH CÙNG NHÀ XE THÀNH NHÂN</span>
          </div>
        </footer>
      </article>
    </section>
  )
}

export default BookingTicket
