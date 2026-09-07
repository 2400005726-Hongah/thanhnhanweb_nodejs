import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import heroBusImage from '../assets/anhtrangchu.jpg'
import TripSearchForm from '../components/search/TripSearchForm.jsx'
import RoomTypeDialog from '../components/seats/RoomTypeDialog.jsx'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getPublicBusTypeImages } from '../services/busTypeImage.service.js'
import {
  getTripSearchCatalog,
  getTripSeats,
  getTripServicePoints,
  searchTrips,
} from '../services/publicTrip.service.js'

import {
  clearBookingPassengerDraft,
  getBookingSeatDraft,
  saveBookingSeatDraft,
} from '../utils/bookingFlowDraft.js'
import { clearBookingServiceSelection } from '../utils/bookingServiceSelection.js'
import {
  getBusTypeLabel,
  getSeatTypeLabel,
  isRoomBusType,
} from '../utils/busTypes.js'
import formatCurrency from '../utils/formatCurrency.js'
import { formatTime } from '../utils/formatDateTime.js'

import './SearchTripsPage.css'

const parseIdList = (value) =>
  value
    ? String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

const sanitizePriceInput = (value) => {
  const digitsOnly = String(value ?? '').replace(/\D/g, '')
  if (!digitsOnly) return ''

  const normalized = digitsOnly.replace(/^0+(?=\d)/, '')
  return normalized.slice(0, 10)
}


const MAX_SELECTED_SEATS = 6
const INLINE_SEAT_EXPANDED_KEY = 'thanhnhan.search.expanded-trip'

const readExpandedTripId = () => {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(INLINE_SEAT_EXPANDED_KEY) || ''
}

const writeExpandedTripId = (tripId) => {
  if (typeof window === 'undefined') return
  if (tripId) window.sessionStorage.setItem(INLINE_SEAT_EXPANDED_KEY, tripId)
  else window.sessionStorage.removeItem(INLINE_SEAT_EXPANDED_KEY)
}

const getTripRouteLabel = (trip) => {
  const route = trip?.route || {}
  const departure = route.departureLocation || {}
  const arrival = route.arrivalLocation || {}

  return (
    route.routeName ||
    `${departure.name || 'Điểm đi'} → ${arrival.name || 'Điểm đến'}`
  )
}

const getTripPriceLabel = (trip) => {
  if (isRoomBusType(trip?.bus?.busType)) {
    return {
      primary: `Đơn ${formatCurrency(trip.singleRoomPrice)}`,
      secondary: `Đôi ${formatCurrency(trip.doubleRoomPrice)}`,
    }
  }

  return {
    primary: formatCurrency(trip.ticketPrice),
    secondary: '',
  }
}

function InlineTripSeatPicker({ trip }) {
  const navigate = useNavigate()
  const [seatData, setSeatData] = useState(null)
  const [selected, setSelected] = useState(new Map())
  const [roomChoiceSeat, setRoomChoiceSeat] = useState(null)
  const [loadingSeats, setLoadingSeats] = useState(true)
  const [seatError, setSeatError] = useState('')
  const [notice, setNotice] = useState('')
  const [leaving, setLeaving] = useState(false)

  const roomBus = isRoomBusType(trip?.bus?.busType)

  const loadSeats = useCallback(async () => {
    setLoadingSeats(true)
    setSeatError('')
    setNotice('')

    try {
      const seats = await getTripSeats(trip.id)
      setSeatData(seats)

      const draft = getBookingSeatDraft(trip.id)
      const allSeats = (seats?.floors || []).flatMap((floor) => floor.seats || [])
      const seatById = new Map(allSeats.map((seat) => [seat.id, seat]))
      const restored = new Map()

      for (const oldSeat of draft?.seats || []) {
        const currentSeat = seatById.get(oldSeat.id)
        if (currentSeat?.status === 'AVAILABLE') {
          restored.set(currentSeat.id, {
            ...currentSeat,
            seatType: oldSeat.seatType,
            price: oldSeat.price,
          })
        }
      }

      setSelected(restored)
    } catch (requestError) {
      setSeatError(getApiErrorMessage(requestError))
    } finally {
      setLoadingSeats(false)
    }
  }, [trip.id])

  useEffect(() => {
    loadSeats()
  }, [loadSeats])

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return
    setNotice('')

    if (selected.has(seat.id)) {
      setSelected((current) => {
        const next = new Map(current)
        next.delete(seat.id)
        return next
      })
      return
    }

    if (selected.size >= MAX_SELECTED_SEATS) {
      setNotice(`Chỉ được chọn tối đa ${MAX_SELECTED_SEATS} vị trí cho một lần đặt vé.`)
      return
    }

    if (roomBus) {
      setRoomChoiceSeat(seat)
      return
    }

    setSelected((current) => new Map(current).set(seat.id, seat))
  }

  const chooseRoomType = (roomType) => {
    if (!roomChoiceSeat) return

    const price =
      roomType === 'DOUBLE_ROOM'
        ? Number(trip.doubleRoomPrice || 0)
        : Number(trip.singleRoomPrice || 0)

    setSelected((current) => {
      const next = new Map(current)
      next.set(roomChoiceSeat.id, {
        ...roomChoiceSeat,
        seatType: roomType,
        price,
      })
      return next
    })

    setRoomChoiceSeat(null)
  }

  const totalAmount = useMemo(
    () =>
      [...selected.values()].reduce(
        (total, seat) => total + Number(seat.price || 0),
        0,
      ),
    [selected],
  )

  const roomSelections = useMemo(
    () =>
      roomBus
        ? [...selected.values()].map((seat) => ({
            tripSeatId: seat.id,
            roomType: seat.seatType,
          }))
        : [],
    [roomBus, selected],
  )

  const selectedSeatText = useMemo(
    () =>
      selected.size
        ? [...selected.values()]
            .map((seat) =>
              roomBus
                ? `${seat.seatCode} (${getSeatTypeLabel(seat.seatType)})`
                : seat.seatCode,
            )
            .join(', ')
        : 'Chưa chọn',
    [roomBus, selected],
  )

  const continueToServicePoints = () => {
    if (!selected.size || leaving) return

    setLeaving(true)
    setNotice('')

    try {
      saveBookingSeatDraft(trip.id, {
        seats: [...selected.values()],
        roomSelections,
        totalAmount,
      })

      clearBookingServiceSelection(trip.id)
      clearBookingPassengerDraft(trip.id)

      navigate(`/dat-ve/${trip.id}`)
    } catch {
      setLeaving(false)
      setNotice('Không thể lưu vị trí đã chọn. Vui lòng thử lại.')
    }
  }

  if (loadingSeats) {
    return (
      <div className="search-inline-seat-loading">
        Đang tải sơ đồ ghế...
      </div>
    )
  }

  if (seatError || !seatData) {
    return (
      <div className="search-inline-seat-error">
        <span>{seatError || 'Không thể tải sơ đồ ghế.'}</span>
        <button className="btn btn-outline-secondary btn-sm" onClick={loadSeats} type="button">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="search-inline-seat-panel">
      <div className="search-inline-seat-legend">
        <span><i className="is-available" />Còn trống</span>
        <span><i className="is-selected" />Đang chọn</span>
        <span><i className="is-unavailable" />Đã đặt</span>
      </div>

      {roomBus && (
        <div className="search-inline-room-note">
          <strong>Lưu ý khi chọn phòng</strong>
          <div>
            <span>
              <b>Phòng đơn</b>
              <small>Tối đa 1 khách</small>
              <em>{formatCurrency(trip.singleRoomPrice)}</em>
            </span>
            <span>
              <b>Phòng đôi</b>
              <small>Tối đa 2 khách</small>
              <em>{formatCurrency(trip.doubleRoomPrice)}</em>
            </span>
          </div>
        </div>
      )}

      <div className="search-inline-seat-layout">
        <div className="search-inline-seat-map">
          <div className="search-inline-seat-map__title">
            Sơ đồ vị trí ({getBusTypeLabel(trip.bus.busType)})
          </div>

          <div
            className={`search-inline-seat-floors ${
              roomBus ? 'is-room-bus' : 'is-sleeper-bus'
            }`}
          >
            {(seatData.floors || []).map((floor) => (
              <section className="search-inline-floor" key={floor.floor}>
                <h3>{floor.floor === 1 ? 'TẦNG DƯỚI' : 'TẦNG TRÊN'}</h3>

                <div className="search-inline-seat-grid">
                  {(floor.seats || []).map((seat) => {
                    const isSelected = selected.has(seat.id)
                    const unavailable = seat.status !== 'AVAILABLE'

                    return (
                      <button
                        aria-label={`${seat.seatCode} ${
                          unavailable
                            ? 'đã đặt'
                            : isSelected
                              ? 'đang chọn'
                              : 'còn trống'
                        }`}
                        aria-pressed={isSelected}
                        className={[
                          'search-inline-seat',
                          isSelected ? 'is-selected' : '',
                          unavailable ? 'is-unavailable' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={unavailable}
                        key={seat.id}
                        onClick={() => toggleSeat(seat)}
                        type="button"
                      >
                        {seat.seatCode}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="search-inline-booking-summary">
          <h3>Chi tiết đặt chỗ</h3>

          <div>
            <span>Tuyến</span>
            <strong>{getTripRouteLabel(trip)}</strong>
          </div>

          <div>
            <span>Giờ chạy</span>
            <strong>{formatTime(trip.departureTime)}</strong>
          </div>

          <div>
            <span>Dòng xe</span>
            <strong>{getBusTypeLabel(trip.bus.busType)}</strong>
          </div>

          <div>
            <span>{roomBus ? 'Phòng đang chọn' : 'Ghế đang chọn'}</span>
            <strong className={selected.size ? 'has-selection' : ''}>
              {selectedSeatText}
            </strong>
          </div>

          <div className="search-inline-total">
            <span>Tạm tính</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>

          <button
            className="btn search-inline-continue"
            disabled={!selected.size || leaving}
            onClick={continueToServicePoints}
            type="button"
          >
            {leaving ? 'Đang chuyển...' : 'Tiếp tục'}
          </button>

          <small>
            Sau bước này hệ thống chuyển thẳng sang chọn điểm đón/trả.
            Ghế/phòng chưa bị giữ ở bước hiện tại.
          </small>

          {notice && <div className="search-inline-notice">{notice}</div>}
        </aside>
      </div>

      <RoomTypeDialog
        seat={roomChoiceSeat}
        singleRoomPrice={trip.singleRoomPrice}
        doubleRoomPrice={trip.doubleRoomPrice}
        onChoose={chooseRoomType}
        onClose={() => setRoomChoiceSeat(null)}
      />
    </div>
  )
}

const TRIP_DETAIL_TABS = [
  { id: 'images', label: 'Hình ảnh', icon: '▣' },
  { id: 'amenities', label: 'Tiện ích', icon: '✦' },
  { id: 'points', label: 'Điểm đón, trả', icon: '⌖' },
  { id: 'cancellation', label: 'Chính sách hủy', icon: '♢' },
]

const STATIC_AMENITIES = [
  { icon: '◉', title: 'Wifi', text: 'Kết nối Internet không dây trong phạm vi phục vụ của xe.' },
  { icon: '❄', title: 'Máy lạnh', text: 'Không gian xe được điều hòa trong suốt hành trình.' },
  { icon: 'ϟ', title: 'Cổng sạc', text: 'Hỗ trợ sạc điện thoại và thiết bị cá nhân.' },
  { icon: '◔', title: 'Nước uống', text: 'Nước uống phục vụ hành khách trong chuyến đi.' },
  { icon: '☾', title: 'Chăn đắp', text: 'Chăn được chuẩn bị cho hành khách khi nghỉ ngơi trên xe.' },
  { icon: '▥', title: 'Rèm cửa', text: 'Rèm che hỗ trợ tạo không gian nghỉ ngơi thoải mái.' },
  { icon: '♡', title: 'Dây đai an toàn', text: 'Trang bị dây đai hỗ trợ an toàn cho hành khách.' },
  { icon: '▭', title: 'Tivi LED', text: 'Trang bị Tivi LED phục vụ nhu cầu giải trí chung.' },
  { icon: '✓', title: 'Dép', text: 'Có dép sử dụng trên xe, thuận tiện khi nghỉ ngơi.' },
  { icon: '◒', title: 'Khăn lạnh', text: 'Khăn lạnh phục vụ hành khách trong chuyến đi.' },
  { icon: '□', title: 'Gối nằm', text: 'Trang bị gối nằm giúp hành khách nghỉ ngơi thoải mái hơn.' },
  { icon: '⚒', title: 'Búa phá kính', text: 'Trang bị búa phá kính dùng trong trường hợp khẩn cấp.' },
]

const CANCELLATION_POLICY = [
  {
    icon: '◷',
    title: 'Trước giờ khởi hành',
    text: 'Khách có thể yêu cầu hủy vé khi chuyến chưa đến giờ xuất bến.',
  },
  {
    icon: '▣',
    title: 'Vé chưa thanh toán',
    text: 'Nếu hủy hợp lệ trước giờ khởi hành, vé được hủy và vị trí được mở lại; không phát sinh khoản hoàn tiền.',
  },
  {
    icon: '▤',
    title: 'Vé đã thanh toán',
    text: 'Nếu hủy hợp lệ trước giờ khởi hành, hệ thống ghi nhận hoàn 100% số tiền đã thanh toán theo chính sách hiện tại.',
  },
  {
    icon: '♧',
    title: 'Sau giờ khởi hành',
    text: 'Vé không còn thuộc quy trình hủy thông thường. Nếu khách không có mặt, vé có thể được ghi nhận là Không đi và không tự động hoàn tiền.',
  },
]

const getBusTypeGallery = (data) => {
  const images = Array.isArray(data?.images) ? data.images : []
  const urls = images
    .map((item) => item?.imageUrl)
    .filter((url) => typeof url === 'string' && url.trim())

  return urls.length ? urls : [heroBusImage]
}

const formatServicePointTime = (point) => {
  // Giờ đón/trả được quản trị nhập trực tiếp ở cấu hình chuyến.
  // estimatedTime là nguồn chuẩn cần hiển thị; không lấy estimatedDateTime
  // được suy ra từ estimatedMinutes vì có thể làm sai giờ đã nhập.
  const rawTime = point?.estimatedTime
  if (rawTime) {
    const match = String(rawTime).match(/(?:T|^)(\d{2}):(\d{2})/)
    if (match) return `${match[1]}:${match[2]}`
  }

  const fallback = point?.estimatedDateTime
  if (!fallback) return '--:--'
  try {
    return formatTime(fallback)
  } catch {
    return '--:--'
  }
}

const sortServicePoints = (points = []) =>
  [...points].sort((a, b) => {
    if (Boolean(a?.isDefault) !== Boolean(b?.isDefault)) {
      return a?.isDefault ? -1 : 1
    }
    return Number(a?.sortOrder || 999) - Number(b?.sortOrder || 999)
  })

function InlineTripDetailPanel({ trip }) {
  const [activeTab, setActiveTab] = useState('images')
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [typeImageData, setTypeImageData] = useState(null)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [servicePointData, setServicePointData] = useState(null)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [pointsError, setPointsError] = useState('')
  const thumbsRef = useRef(null)
  const gallery = useMemo(() => getBusTypeGallery(typeImageData), [typeImageData])

  useEffect(() => {
    if (activeTab !== 'images' || typeImageData) return undefined

    let active = true
    setImagesLoading(true)

    getPublicBusTypeImages(trip?.bus?.busType)
      .then((data) => {
        if (active) setTypeImageData(data)
      })
      .catch(() => {
        if (active) setTypeImageData({ images: [] })
      })
      .finally(() => {
        if (active) setImagesLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeTab, trip?.bus?.busType, typeImageData])

  useEffect(() => {
    if (activeTab !== 'points' || servicePointData) return undefined

    let active = true
    setPointsLoading(true)
    setPointsError('')

    getTripServicePoints(trip.id)
      .then((data) => {
        if (active) setServicePointData(data)
      })
      .catch((requestError) => {
        if (active) setPointsError(getApiErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setPointsLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeTab, servicePointData, trip.id])

  useEffect(() => {
    if (galleryIndex >= gallery.length) setGalleryIndex(0)
  }, [gallery.length, galleryIndex])

  useEffect(() => {
    const container = thumbsRef.current
    const activeThumb = container?.querySelector(`[data-gallery-index="${galleryIndex}"]`)
    if (!container || !activeThumb) return

    const left = activeThumb.offsetLeft
    const right = left + activeThumb.offsetWidth
    const viewLeft = container.scrollLeft
    const viewRight = viewLeft + container.clientWidth

    if (left < viewLeft || right > viewRight) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [galleryIndex])

  const changeImage = (direction) => {
    setGalleryIndex((current) => {
      const total = gallery.length
      if (total <= 1) return 0
      return (current + direction + total) % total
    })
  }

  const scrollThumbs = (direction) => {
    const container = thumbsRef.current
    if (!container) return
    container.scrollBy({
      left: direction * container.clientWidth,
      behavior: 'smooth',
    })
  }

  return (
    <section className="search-trip-detail-panel">
      <nav className="search-trip-detail-tabs" aria-label="Thông tin chi tiết chuyến xe">
        {TRIP_DETAIL_TABS.map((tab) => (
          <button
            className={activeTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="search-trip-detail-body">
        {activeTab === 'images' && (
          <div className="search-trip-gallery">
            <div className="search-trip-gallery__stage">
              <img
                alt={`${getBusTypeLabel(trip?.bus?.busType)} - Nhà xe Thành Nhân`}
                src={gallery[galleryIndex]}
              />

              {gallery.length > 1 && (
                <>
                  <button
                    aria-label="Ảnh trước"
                    className="search-trip-gallery__arrow is-prev"
                    onClick={() => changeImage(-1)}
                    type="button"
                  >
                    ‹
                  </button>
                  <button
                    aria-label="Ảnh sau"
                    className="search-trip-gallery__arrow is-next"
                    onClick={() => changeImage(1)}
                    type="button"
                  >
                    ›
                  </button>
                </>
              )}

              <span className="search-trip-gallery__counter">
                {galleryIndex + 1}/{gallery.length}
              </span>
            </div>

            {gallery.length > 1 && (
              <div className="search-trip-gallery__thumb-nav">
                {gallery.length > 6 && (
                  <button
                    aria-label="Xem nhóm ảnh trước"
                    className="search-trip-gallery__thumb-arrow is-prev"
                    onClick={() => scrollThumbs(-1)}
                    type="button"
                  >
                    ‹
                  </button>
                )}

                <div className="search-trip-gallery__thumbs" ref={thumbsRef}>
                  {gallery.map((image, index) => (
                    <button
                      className={index === galleryIndex ? 'is-active' : ''}
                      data-gallery-index={index}
                      key={`${image}-${index}`}
                      onClick={() => setGalleryIndex(index)}
                      type="button"
                    >
                      <img alt={`Ảnh xe ${index + 1}`} src={image} />
                    </button>
                  ))}
                </div>

                {gallery.length > 6 && (
                  <button
                    aria-label="Xem nhóm ảnh sau"
                    className="search-trip-gallery__thumb-arrow is-next"
                    onClick={() => scrollThumbs(1)}
                    type="button"
                  >
                    ›
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'amenities' && (
          <div className="search-trip-amenities">
            <div className="search-trip-detail-intro">
              <strong>Tiện ích {getBusTypeLabel(trip?.bus?.busType)}</strong>
              <span>Các tiện ích tiêu chuẩn được hiển thị tự động theo dòng xe.</span>
            </div>

            <div className="search-trip-amenities__grid">
              {STATIC_AMENITIES.map((item) => (
                <article key={item.title}>
                  <span className="search-trip-amenities__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'points' && (
          <div className="search-trip-service-points">
            <div className="search-trip-points-note">
              <strong>Lưu ý:</strong> Các mốc giờ đón/trả là thời gian dự kiến theo cấu hình của chuyến và có thể thay đổi theo tình hình thực tế. Khách sẽ chọn điểm phục vụ cụ thể sau khi chọn ghế/phòng.
            </div>

            {pointsLoading ? (
              <div className="search-trip-detail-state">Đang tải điểm đón/trả của chuyến...</div>
            ) : pointsError ? (
              <div className="search-trip-detail-state is-error">{pointsError}</div>
            ) : servicePointData ? (
              <div className="search-trip-points-columns">
                {[
                  ['Điểm đón', 'pickupPoints', 'is-pickup'],
                  ['Điểm trả', 'dropoffPoints', 'is-dropoff'],
                ].map(([title, key, className]) => (
                  <section className={className} key={key}>
                    <h3>{title}</h3>
                    <div className="search-trip-points-list">
                      {(servicePointData[key] || []).length ? (
                        sortServicePoints(servicePointData[key]).map((point, index) => (
                          <div className="search-trip-point-row" key={point.id || `${key}-${index}`}>
                            <strong>{formatServicePointTime(point)}</strong>
                            <div>
                              <b>{point.location?.name || 'Chưa cập nhật'}</b>
                              {point.location?.address && <small>{point.location.address}</small>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>Chuyến chưa cấu hình thêm điểm phục vụ.</p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'cancellation' && (
          <div className="search-trip-cancellation">
            <div className="search-trip-cancellation__grid">
              {CANCELLATION_POLICY.map((item) => (
                <article key={item.title}>
                  <span aria-hidden="true">{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="search-trip-cancellation__warning">
              <strong>▲</strong>
              <span>
                Hệ thống theo dõi các vé Đã hủy và Không đi. Khi một số điện thoại có từ 3 lần thuộc các trường hợp này, quyền tạo vé mới có thể bị tạm chặn trên các kênh đặt vé của nhà xe.
              </span>
            </div>

            <div className="search-trip-cancellation__link">
              <Link to="/thong-tin/chinh-sach-huy-ve">Xem đầy đủ chính sách hủy vé →</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function SearchTripBookingCard({
  trip,
  seatExpanded,
  detailExpanded,
  onToggleSeat,
  onToggleDetail,
}) {
  const price = getTripPriceLabel(trip)
  const route = trip.route || {}
  const departure = route.departureLocation || {}
  const arrival = route.arrivalLocation || {}
  const expanded = seatExpanded || detailExpanded

  return (
    <article className={`search-booking-trip-card${expanded ? ' is-expanded' : ''}`}>
      <div className="search-booking-trip-card__main">
        <div className="search-booking-trip-time">
          <strong>{formatTime(trip.departureTime)}</strong>
          <small>
            {new Intl.DateTimeFormat('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }).format(new Date(trip.departureTime))}
          </small>
        </div>

        <div className="search-booking-trip-route">
          <h2>
            {departure.name || 'Điểm đi'}
            <span>→</span>
            {arrival.name || 'Điểm đến'}
          </h2>
          <small>{getBusTypeLabel(trip.bus.busType)}</small>

          <button
            aria-expanded={detailExpanded}
            className="search-booking-detail-toggle"
            onClick={onToggleDetail}
            type="button"
          >
            Thông tin chi tiết
            <span>{detailExpanded ? '⌃' : '⌄'}</span>
          </button>
        </div>

        <div className="search-booking-trip-price">
          <strong>{price.primary}</strong>
          {price.secondary && <small>{price.secondary}</small>}

          <button
            aria-expanded={seatExpanded}
            className="search-booking-choose-btn"
            onClick={onToggleSeat}
            type="button"
          >
            {seatExpanded ? 'Thu gọn sơ đồ ghế' : 'Chọn ghế / Đặt vé'}
          </button>
        </div>
      </div>

      {detailExpanded && <InlineTripDetailPanel trip={trip} />}
      {seatExpanded && <InlineTripSeatPicker trip={trip} />}
    </article>
  )
}

function SearchTripsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryString = searchParams.toString()
  const query = useMemo(
    () => Object.fromEntries(new URLSearchParams(queryString).entries()),
    [queryString],
  )
  const requiredReady =
    query.departureProvinceId &&
    query.arrivalProvinceId &&
    query.departureDate

  const [catalog, setCatalog] = useState({ provinces: [] })
  const [result, setResult] = useState({ trips: [], pagination: null })
  const [loading, setLoading] = useState(Boolean(requiredReady))
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [error, setError] = useState('')
  const [priceDrafts, setPriceDrafts] = useState({
    minPrice: query.minPrice || '',
    maxPrice: query.maxPrice || '',
  })
  const [expandedTripId, setExpandedTripId] = useState(readExpandedTripId)
  const [detailTripId, setDetailTripId] = useState('')


  useEffect(() => {
    setPriceDrafts({
      minPrice: query.minPrice || '',
      maxPrice: query.maxPrice || '',
    })
  }, [query.minPrice, query.maxPrice])

  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    getTripSearchCatalog()
      .then((data) => active && setCatalog({ provinces: data?.provinces ?? [] }))
      .catch((requestError) => active && setError(getApiErrorMessage(requestError)))
      .finally(() => active && setCatalogLoading(false))

    return () => {
      active = false
    }
  }, [])

  const loadTrips = useCallback(() => {
    if (!requiredReady) return
    setLoading(true)
    setError('')
    searchTrips(Object.fromEntries(new URLSearchParams(queryString).entries()))
      .then(setResult)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false))
  }, [queryString, requiredReady])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  const departureProvince = useMemo(
    () =>
      catalog.provinces.find(
        (province) => province.id === query.departureProvinceId,
      ),
    [catalog.provinces, query.departureProvinceId],
  )
  const arrivalProvince = useMemo(
    () =>
      catalog.provinces.find(
        (province) => province.id === query.arrivalProvinceId,
      ),
    [catalog.provinces, query.arrivalProvinceId],
  )

  const departureAreaIds = useMemo(
    () => parseIdList(query.departureAreaIds),
    [query.departureAreaIds],
  )
  const arrivalAreaIds = useMemo(
    () => parseIdList(query.arrivalAreaIds),
    [query.arrivalAreaIds],
  )

  const updateFilter = (event) => {
    const { name, value } = event.target
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value !== '') next.set(name, value)
      else next.delete(name)
      next.set('page', '1')
      return next
    })
  }

  const updatePriceDraft = (event) => {
    const { name, value } = event.target
    setPriceDrafts((current) => ({
      ...current,
      [name]: sanitizePriceInput(value),
    }))
  }

  const commitPriceFilter = (name) => {
    const value = priceDrafts[name] ?? ''
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value !== '') next.set(name, value)
      else next.delete(name)
      next.set('page', '1')
      return next
    }, { replace: true })
  }

  const handlePriceKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    event.currentTarget.blur()
  }

  const toggleAreaFilter = (queryName, areaId) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      const currentIds = parseIdList(next.get(queryName))
      const nextIds = currentIds.includes(areaId)
        ? currentIds.filter((id) => id !== areaId)
        : [...currentIds, areaId]

      if (nextIds.length > 0) next.set(queryName, nextIds.join(','))
      else next.delete(queryName)

      next.set('page', '1')
      return next
    })
  }

  const resetAdvancedFilters = () => {
    setPriceDrafts({ minPrice: '', maxPrice: '' })
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of [
        'departureAreaIds',
        'arrivalAreaIds',
        'minPrice',
        'maxPrice',
        'departureTimeFrom',
        'departureTimeTo',
        'busType',
        'sort',
      ]) {
        next.delete(key)
      }
      next.set('page', '1')
      return next
    })
  }

  const setPage = (page) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(page))
      return next
    })
  }

  return (
    <div className="page-surface search-trips-page">
      <div className="container search-trips-page__content">
        <TripSearchForm
          compact
          initialValues={{
            departureProvinceId: query.departureProvinceId || '',
            arrivalProvinceId: query.arrivalProvinceId || '',
            departureDate: query.departureDate || '',
          }}
        />

        {!requiredReady && (
          <section className="search-trips-welcome" aria-label="Hướng dẫn đặt vé">
            <div className="search-trips-welcome__content">
              <span className="search-trips-welcome__eyebrow">ĐẶT VÉ THÀNH NHÂN</span>
              <h1>Chuyến đi bắt đầu từ đây</h1>
              <p className="search-trips-welcome__lead">
                Chọn nơi đi, nơi đến và ngày khởi hành ở phía trên để xem
                các chuyến xe đang mở bán.
              </p>

              <div className="search-trips-welcome__steps">
                <div>
                  <span>01</span>
                  <strong>Chọn hành trình</strong>
                  <small>Chọn tỉnh/thành đi, đến và ngày đi.</small>
                </div>
                <div>
                  <span>02</span>
                  <strong>Chọn chuyến & chỗ</strong>
                  <small>Xem giờ chạy, loại xe và vị trí còn trống.</small>
                </div>
                <div>
                  <span>03</span>
                  <strong>Hoàn tất đặt vé</strong>
                  <small>Chọn điểm đón trả, nhập thông tin và thanh toán.</small>
                </div>
              </div>

              <div className="search-trips-welcome__note">
                <span>✓</span>
                Không cần đăng nhập để tìm chuyến và đặt vé Online.
              </div>
            </div>

            <div className="search-trips-welcome__visual">
              <img src={heroBusImage} alt="Xe khách Thành Nhân" loading="lazy" />
              <div className="search-trips-welcome__badge">
                <strong>Thành Nhân</strong>
                <span>An toàn • Chu đáo • Thân thiện</span>
              </div>
            </div>
          </section>
        )}

        {requiredReady && (
          <div className="search-trips-layout">
            <aside className="search-trips-sidebar">
              <div className="search-trips-sidebar__head">
                <strong>Bộ lọc tìm kiếm</strong>
                <button
                  className="search-trips-reset"
                  onClick={resetAdvancedFilters}
                  type="button"
                >
                  Xóa lọc
                </button>
              </div>

              <div className="search-filter-group">
                <strong>Khu vực điểm đi</strong>
                <small>{departureProvince?.name || 'Tỉnh/Thành đi'}</small>
                <div className="search-filter-options">
                  {catalogLoading ? (
                    <span>Đang tải...</span>
                  ) : departureProvince?.areas?.length ? (
                    departureProvince.areas.map((area) => (
                      <label key={area.id}>
                        <input
                          checked={departureAreaIds.includes(area.id)}
                          onChange={() =>
                            toggleAreaFilter('departureAreaIds', area.id)
                          }
                          type="checkbox"
                        />
                        <span>{area.name}</span>
                      </label>
                    ))
                  ) : (
                    <span>Chưa có khu vực.</span>
                  )}
                </div>
              </div>

              <div className="search-filter-group">
                <strong>Khu vực điểm đến</strong>
                <small>{arrivalProvince?.name || 'Tỉnh/Thành đến'}</small>
                <div className="search-filter-options">
                  {catalogLoading ? (
                    <span>Đang tải...</span>
                  ) : arrivalProvince?.areas?.length ? (
                    arrivalProvince.areas.map((area) => (
                      <label key={area.id}>
                        <input
                          checked={arrivalAreaIds.includes(area.id)}
                          onChange={() =>
                            toggleAreaFilter('arrivalAreaIds', area.id)
                          }
                          type="checkbox"
                        />
                        <span>{area.name}</span>
                      </label>
                    ))
                  ) : (
                    <span>Chưa có khu vực.</span>
                  )}
                </div>
              </div>

              <div className="search-filter-group">
                <label>
                  <span>Giá từ</span>
                  <input
                    autoComplete="off"
                    className="form-control"
                    inputMode="numeric"
                    maxLength="10"
                    name="minPrice"
                    onBlur={() => commitPriceFilter('minPrice')}
                    onChange={updatePriceDraft}
                    onKeyDown={handlePriceKeyDown}
                    pattern="[0-9]*"
                    placeholder="0"
                    type="text"
                    value={priceDrafts.minPrice}
                  />
                </label>

                <label>
                  <span>Giá đến</span>
                  <input
                    autoComplete="off"
                    className="form-control"
                    inputMode="numeric"
                    maxLength="10"
                    name="maxPrice"
                    onBlur={() => commitPriceFilter('maxPrice')}
                    onChange={updatePriceDraft}
                    onKeyDown={handlePriceKeyDown}
                    pattern="[0-9]*"
                    placeholder="2.000.000"
                    type="text"
                    value={priceDrafts.maxPrice}
                  />
                </label>
              </div>

              <div className="search-filter-group search-filter-group--two">
                <label>
                  <span>Giờ từ</span>
                  <input
                    className="form-control"
                    name="departureTimeFrom"
                    onChange={updateFilter}
                    type="time"
                    value={query.departureTimeFrom || ''}
                  />
                </label>

                <label>
                  <span>Giờ đến</span>
                  <input
                    className="form-control"
                    name="departureTimeTo"
                    onChange={updateFilter}
                    type="time"
                    value={query.departureTimeTo || ''}
                  />
                </label>
              </div>

              <div className="search-filter-group">
                <label>
                  <span>Loại xe</span>
                  <select
                    className="form-select"
                    name="busType"
                    value={query.busType || ''}
                    onChange={updateFilter}
                  >
                    <option value="">Tất cả loại xe</option>
                    <option value="SLEEPER_34">Giường nằm 34 giường</option>
                    <option value="LIMOUSINE_22">Limousine 22 phòng</option>
                    <option value="SLEEPER">Giường nằm legacy</option>
                    <option value="LIMOUSINE">Limousine legacy</option>
                    <option value="SEATED">Ghế ngồi legacy</option>
                  </select>
                </label>
              </div>

              <div className="search-filter-group">
                <label>
                  <span>Sắp xếp</span>
                  <select
                    className="form-select"
                    name="sort"
                    value={query.sort || 'departureTimeAsc'}
                    onChange={updateFilter}
                  >
                    <option value="departureTimeAsc">Giờ đi sớm nhất</option>
                    <option value="departureTimeDesc">Giờ đi muộn nhất</option>
                    <option value="priceAsc">Giá thấp đến cao</option>
                    <option value="priceDesc">Giá cao đến thấp</option>
                  </select>
                </label>
              </div>
            </aside>

            <section className="search-trips-results">
              <div className="search-trips-results__head">
                <h1>
                  Chuyến xe có sẵn
                  {!loading && !error && (
                    <span> ({result.pagination?.total ?? 0})</span>
                  )}
                </h1>
              </div>

              {loading ? (
                <LoadingState label="Đang tìm những chuyến xe phù hợp..." />
              ) : error ? (
                <ErrorState message={error} onRetry={loadTrips} />
              ) : result.trips.length === 0 ? (
                <div className="search-trips-no-result">
                  <strong>Không tìm thấy chuyến xe</strong>
                  <span>
                    Vui lòng chọn lại nơi đi, nơi đến, ngày khởi hành hoặc
                    thay đổi bộ lọc.
                  </span>
                </div>
              ) : (
                <>
                  <div className="search-booking-trip-list">
                    {result.trips.map((trip) => (
                      <SearchTripBookingCard
                        detailExpanded={detailTripId === trip.id}
                        key={trip.id}
                        onToggleDetail={() => {
                          setExpandedTripId('')
                          writeExpandedTripId('')
                          setDetailTripId((current) =>
                            current === trip.id ? '' : trip.id,
                          )
                        }}
                        onToggleSeat={() => {
                          setDetailTripId('')
                          setExpandedTripId((current) => {
                            const next = current === trip.id ? '' : trip.id
                            writeExpandedTripId(next)
                            return next
                          })
                        }}
                        seatExpanded={expandedTripId === trip.id}
                        trip={trip}
                      />
                    ))}
                  </div>

                  {result.pagination?.totalPages > 1 && (
                    <nav
                      className="pagination-wrap"
                      aria-label="Phân trang chuyến xe"
                    >
                      <button
                        className="btn btn-outline-primary"
                        disabled={result.pagination.page <= 1}
                        onClick={() => setPage(result.pagination.page - 1)}
                      >
                        Trang trước
                      </button>
                      <span>
                        Trang {result.pagination.page}/
                        {result.pagination.totalPages}
                      </span>
                      <button
                        className="btn btn-outline-primary"
                        disabled={
                          result.pagination.page >=
                          result.pagination.totalPages
                        }
                        onClick={() => setPage(result.pagination.page + 1)}
                      >
                        Trang sau
                      </button>
                    </nav>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchTripsPage
