import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  configureTripServicePoints,
  getLocationCatalog,
  getTrip,
  getTripServicePoints,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { getBusTypeLabel } from '../../utils/busTypes.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'
import './AdminTripServicePointsPage.css'

const EMPTY_SETTINGS = {
  primaryPickupMode: 'DonTaiBenXe',
  primaryDropoffMode: 'TraTaiBenXe',
  allowPickupTransfer: false,
  allowPickupMeetingPoint: false,
  allowDropoffTransfer: false,
  allowDropoffStop: false,
}

const toTimeInput = (value) => {
  if (!value) return ''
  const raw = String(value)
  const hhmm = raw.match(/(?:T|^)(\d{2}:\d{2})/)
  return hhmm?.[1] || raw.slice(0, 5)
}

const provinceIdOf = (location) =>
  location?.provinceId || location?.provinceRef?.id || null

const provinceNameOf = (location) =>
  location?.provinceRef?.name || location?.province || 'Chưa xác định'

const formatLocation = (location) => {
  if (!location) return 'Chưa có địa điểm cụ thể'
  return [location.name, location.address].filter(Boolean).join(' – ')
}

const newPoint = (pointType, locationId = '') => ({
  id: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  locationId,
  pointType,
  serviceMode: pointType === 'PICKUP' ? 'DonTaiDiemHen' : 'TraTaiDiemDung',
  estimatedTime: '',
  status: 'ACTIVE',
})

function ChoiceCard({ checked, disabled, description, label, name, onChange, value }) {
  return (
    <label className={`trip-service-choice ${checked ? 'is-selected' : ''}`}>
      <input
        checked={checked}
        disabled={disabled}
        name={name}
        onChange={() => onChange(value)}
        type="radio"
        value={value}
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  )
}

function ToggleCard({ checked, disabled, description, label, onChange }) {
  return (
    <label className={`trip-service-toggle ${checked ? 'is-enabled' : ''}`}>
      <span className="trip-service-switch">
        <input
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  )
}

function AdminTripServicePointsPage() {
  const { tripId } = useParams()
  const [trip, setTrip] = useState(null)
  const [catalog, setCatalog] = useState({ locations: [] })
  const [settings, setSettings] = useState({ ...EMPTY_SETTINGS })
  const [meetingPoints, setMeetingPoints] = useState([])
  const [dropoffStops, setDropoffStops] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [tripData, catalogData, serviceData] = await Promise.all([
        getTrip(tripId),
        getLocationCatalog(),
        getTripServicePoints(tripId),
      ])

      const currentTrip = serviceData?.trip || tripData?.trip || tripData
      const loadedTrip = tripData?.trip || tripData
      const points = (serviceData?.servicePoints ?? []).filter(
        (point) => point.status === 'ACTIVE' && point.isDefault !== true,
      )

      setTrip(loadedTrip)
      setCatalog({ locations: catalogData?.locations ?? [] })
      setSettings({
        primaryPickupMode: currentTrip?.primaryPickupMode || 'DonTaiBenXe',
        primaryDropoffMode: currentTrip?.primaryDropoffMode || 'TraTaiBenXe',
        allowPickupTransfer: currentTrip?.allowPickupTransfer === true,
        allowPickupMeetingPoint: currentTrip?.allowPickupMeetingPoint === true,
        allowDropoffTransfer: currentTrip?.allowDropoffTransfer === true,
        allowDropoffStop: currentTrip?.allowDropoffStop === true,
      })
      setMeetingPoints(
        points
          .filter(
            (point) =>
              point.pointType === 'PICKUP' &&
              point.serviceMode === 'DonTaiDiemHen',
          )
          .map((point) => ({
            id: point.id,
            locationId: point.locationId || point.location?.id || '',
            pointType: 'PICKUP',
            serviceMode: 'DonTaiDiemHen',
            estimatedTime: toTimeInput(point.estimatedTime),
            status: 'ACTIVE',
          })),
      )
      setDropoffStops(
        points
          .filter(
            (point) =>
              point.pointType === 'DROPOFF' &&
              point.serviceMode === 'TraTaiDiemDung',
          )
          .map((point) => ({
            id: point.id,
            locationId: point.locationId || point.location?.id || '',
            pointType: 'DROPOFF',
            serviceMode: 'TraTaiDiemDung',
            estimatedTime: toTimeInput(point.estimatedTime),
            status: 'ACTIVE',
          })),
      )
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    load()
  }, [load])

  const isLocked = useMemo(() => {
    if (!trip) return false
    return (
      new Date(trip.departureTime) <= new Date() ||
      ['COMPLETED', 'CANCELLED'].includes(trip.status)
    )
  }, [trip])

  const departureLocation = trip?.departureLocation || trip?.route?.departureLocation
  const arrivalLocation = trip?.arrivalLocation || trip?.route?.arrivalLocation
  const departureProvinceId = provinceIdOf(departureLocation)
  const arrivalProvinceId = provinceIdOf(arrivalLocation)

  const pickupCatalog = useMemo(
    () =>
      catalog.locations.filter(
        (location) =>
          location.status === 'ACTIVE' &&
          provinceIdOf(location) === departureProvinceId &&
          ['PICKUP', 'BOTH'].includes(location.locationType || 'BOTH') &&
          location.id !== departureLocation?.id,
      ),
    [catalog.locations, departureLocation?.id, departureProvinceId],
  )

  const dropoffCatalog = useMemo(
    () =>
      catalog.locations.filter(
        (location) =>
          location.status === 'ACTIVE' &&
          provinceIdOf(location) === arrivalProvinceId &&
          ['DROPOFF', 'BOTH'].includes(location.locationType || 'BOTH') &&
          location.id !== arrivalLocation?.id,
      ),
    [arrivalLocation?.id, arrivalProvinceId, catalog.locations],
  )

  const addMeetingPoint = () => {
    const used = new Set(meetingPoints.map((point) => point.locationId))
    const available = pickupCatalog.find((location) => !used.has(location.id))
    if (!available) {
      window.alert('Không còn địa điểm đón phù hợp trong Tỉnh/Thành đi để thêm làm điểm hẹn.')
      return
    }
    setMeetingPoints((current) => [...current, newPoint('PICKUP', available.id)])
  }

  const addDropoffStop = () => {
    const used = new Set(dropoffStops.map((point) => point.locationId))
    const available = dropoffCatalog.find((location) => !used.has(location.id))
    if (!available) {
      window.alert('Không còn địa điểm trả phù hợp trong Tỉnh/Thành đến để thêm làm điểm dừng.')
      return
    }
    setDropoffStops((current) => [...current, newPoint('DROPOFF', available.id)])
  }

  const updateListPoint = (setter, index, field, value) => {
    setter((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [field]: value } : point,
      ),
    )
  }

  const availableForRow = (catalogItems, rows, rowIndex) => {
    const used = new Set(
      rows
        .filter((_, index) => index !== rowIndex)
        .map((point) => point.locationId)
        .filter(Boolean),
    )
    return catalogItems.filter((location) => !used.has(location.id))
  }

  const save = async (event) => {
    event.preventDefault()
    if (isLocked) {
      window.alert('Chuyến đã qua giờ khởi hành hoặc đã kết thúc nên không thể sửa điểm đón/trả.')
      return
    }
    if (settings.allowPickupMeetingPoint && meetingPoints.length === 0) {
      window.alert('Bạn đã bật Đón khách tại điểm hẹn. Hãy thêm ít nhất một điểm hẹn.')
      return
    }
    if (settings.allowDropoffStop && dropoffStops.length === 0) {
      window.alert('Bạn đã bật Trả khách tại điểm dừng. Hãy thêm ít nhất một điểm dừng.')
      return
    }

    const enabledMeetingPoints = settings.allowPickupMeetingPoint ? meetingPoints : []
    const enabledDropoffStops = settings.allowDropoffStop ? dropoffStops : []
    if ([...enabledMeetingPoints, ...enabledDropoffStops].some((point) => !point.locationId)) {
      window.alert('Vui lòng chọn đầy đủ địa điểm hẹn/điểm dừng.')
      return
    }
    if ([...enabledMeetingPoints, ...enabledDropoffStops].some((point) => !point.estimatedTime)) {
      window.alert('Vui lòng nhập giờ phục vụ cho từng điểm hẹn/điểm dừng.')
      return
    }

    setSaving(true)
    try {
      await configureTripServicePoints(tripId, {
        ...settings,
        servicePoints: [
          ...enabledMeetingPoints.map((point, index) => ({
            locationId: point.locationId,
            pointType: 'PICKUP',
            serviceMode: 'DonTaiDiemHen',
            estimatedTime: point.estimatedTime,
            sortOrder: index + 2,
            status: 'ACTIVE',
          })),
          ...enabledDropoffStops.map((point, index) => ({
            locationId: point.locationId,
            pointType: 'DROPOFF',
            serviceMode: 'TraTaiDiemDung',
            estimatedTime: point.estimatedTime,
            sortOrder: index + 2,
            status: 'ACTIVE',
          })),
        ],
      })
      window.alert('Đã lưu cấu hình 3 phương án đón và 3 phương án trả của chuyến.')
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <>
      <AdminPageHeader
        title="Điểm đón/trả phục vụ"
        description="Cấu hình riêng cho từng chuyến. Hành trình chính vẫn lấy từ điểm đi và điểm đến cụ thể đã chọn khi tạo chuyến."
        actions={(
          <Link className="btn btn-outline-secondary" to="/admin/chuyen-xe">
            ← Quay lại chuyến xe
          </Link>
        )}
      />

      <section className="admin-panel trip-service-summary">
        <div>
          <span>Hành trình chính</span>
          <strong>{departureLocation?.name || '—'} → {arrivalLocation?.name || '—'}</strong>
          <small>{provinceNameOf(departureLocation)} → {provinceNameOf(arrivalLocation)}</small>
        </div>
        <div>
          <span>Xe</span>
          <strong>{trip?.bus?.busType ? getBusTypeLabel(trip.bus.busType) : '—'}</strong>
          <small>{formatLicensePlate(trip?.bus?.licensePlate)}</small>
        </div>
        <div>
          <span>Khởi hành</span>
          <strong>{formatDateTime(trip?.departureTime)}</strong>
          <small>Dự kiến đến: {formatDateTime(trip?.expectedArrivalTime)}</small>
        </div>
      </section>

      {isLocked && (
        <div className="alert alert-warning">
          Chuyến đã qua giờ khởi hành hoặc đã kết thúc. Bạn vẫn có thể xem cấu hình nhưng không thể thay đổi.
        </div>
      )}

      <form onSubmit={save}>
        <div className="trip-service-columns">
          <section className="admin-panel trip-service-column trip-service-column--pickup">
            <div className="trip-service-column__title">
              <span>📍</span>
              <div>
                <h2>Cấu hình điểm đón</h2>
                <small>Ba phương án khách có thể chọn khi đặt vé.</small>
              </div>
            </div>

            <article className="trip-service-section">
              <div className="trip-service-section__heading">
                <strong>1. Điểm đón chính</strong>
                <span>Tự động: {formatLocation(departureLocation)}</span>
              </div>
              <div className="trip-service-choice-grid">
                <ChoiceCard
                  checked={settings.primaryPickupMode === 'TaiVanPhong'}
                  disabled={isLocked}
                  description="Hành khách cần có mặt trước giờ xuất bến tối thiểu 30 phút."
                  label="Tập trung tại văn phòng nhà xe"
                  name="primaryPickupMode"
                  onChange={(value) => setSettings((current) => ({ ...current, primaryPickupMode: value }))}
                  value="TaiVanPhong"
                />
                <ChoiceCard
                  checked={settings.primaryPickupMode === 'DonTaiBenXe'}
                  disabled={isLocked}
                  description="Vui lòng chủ động đợi xe tại khu vực cột đón khách của nhà xe."
                  label="Đón trực tiếp tại bến xe trung tâm thành phố"
                  name="primaryPickupMode"
                  onChange={(value) => setSettings((current) => ({ ...current, primaryPickupMode: value }))}
                  value="DonTaiBenXe"
                />
              </div>
            </article>

            <article className="trip-service-section">
              <div className="trip-service-section__heading">
                <strong>2. Xe trung chuyển đón khách</strong>
              </div>
              <ToggleCard
                checked={settings.allowPickupTransfer}
                disabled={isLocked}
                description="Khi khách chọn phương án này, hệ thống sẽ hiện ô để khách nhập địa chỉ đón cụ thể."
                label="Cho phép xe trung chuyển đón khách"
                onChange={(value) => setSettings((current) => ({ ...current, allowPickupTransfer: value }))}
              />
            </article>

            <article className="trip-service-section">
              <div className="trip-service-section__heading trip-service-section__heading--with-action">
                <div>
                  <strong>3. Đón khách tại điểm hẹn</strong>
                  <span>Nhân viên chọn địa điểm phục vụ và nhập giờ đón.</span>
                </div>
                <button
                  className="btn btn-sm btn-outline-success"
                  disabled={isLocked || !settings.allowPickupMeetingPoint}
                  onClick={addMeetingPoint}
                  type="button"
                >
                  + Thêm điểm hẹn
                </button>
              </div>
              <ToggleCard
                checked={settings.allowPickupMeetingPoint}
                disabled={isLocked}
                description="Khách sẽ được xổ danh sách các điểm hẹn bên dưới khi đặt vé."
                label="Cho phép đón khách tại điểm hẹn"
                onChange={(value) => setSettings((current) => ({ ...current, allowPickupMeetingPoint: value }))}
              />

              {settings.allowPickupMeetingPoint && (
                <div className="trip-service-point-list">
                  {meetingPoints.length === 0 ? (
                    <div className="trip-service-empty">Chưa có điểm hẹn. Bấm “+ Thêm điểm hẹn”.</div>
                  ) : meetingPoints.map((point, index) => (
                    <div className="trip-service-point-row" key={point.id}>
                      <label>
                        <span>Địa điểm hẹn</span>
                        <select
                          className="form-select"
                          disabled={isLocked}
                          onChange={(event) => updateListPoint(setMeetingPoints, index, 'locationId', event.target.value)}
                          value={point.locationId}
                        >
                          <option value="">Chọn địa điểm</option>
                          {availableForRow(pickupCatalog, meetingPoints, index).map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}{location.address ? ` – ${location.address}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="trip-service-time-field">
                        <span>Giờ đón</span>
                        <input
                          className="form-control"
                          disabled={isLocked}
                          onChange={(event) => updateListPoint(setMeetingPoints, index, 'estimatedTime', event.target.value)}
                          type="time"
                          value={point.estimatedTime}
                        />
                      </label>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={isLocked}
                        onClick={() => setMeetingPoints((current) => current.filter((_, pointIndex) => pointIndex !== index))}
                        type="button"
                      >
                        Bỏ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="admin-panel trip-service-column trip-service-column--dropoff">
            <div className="trip-service-column__title">
              <span>📍</span>
              <div>
                <h2>Cấu hình điểm trả</h2>
                <small>Ba phương án khách có thể chọn khi đặt vé.</small>
              </div>
            </div>

            <article className="trip-service-section">
              <div className="trip-service-section__heading">
                <strong>1. Điểm trả chính</strong>
                <span>Tự động: {formatLocation(arrivalLocation)}</span>
              </div>
              <div className="trip-service-choice-grid">
                <ChoiceCard
                  checked={settings.primaryDropoffMode === 'TraTaiBenXe'}
                  disabled={isLocked}
                  description="Khách xuống xe tại bến xe trung tâm của điểm đến."
                  label="Trả khách tại bến xe trung tâm đích đến"
                  name="primaryDropoffMode"
                  onChange={(value) => setSettings((current) => ({ ...current, primaryDropoffMode: value }))}
                  value="TraTaiBenXe"
                />
                <ChoiceCard
                  checked={settings.primaryDropoffMode === 'TraTaiVanPhong'}
                  disabled={isLocked}
                  description="Khách xuống xe tại văn phòng nhà xe ở điểm đến."
                  label="Trả khách tại văn phòng nhà xe"
                  name="primaryDropoffMode"
                  onChange={(value) => setSettings((current) => ({ ...current, primaryDropoffMode: value }))}
                  value="TraTaiVanPhong"
                />
              </div>
            </article>

            <article className="trip-service-section">
              <div className="trip-service-section__heading">
                <strong>2. Xe trung chuyển trả tận nơi</strong>
              </div>
              <ToggleCard
                checked={settings.allowDropoffTransfer}
                disabled={isLocked}
                description="Khi khách chọn phương án này, hệ thống sẽ hiện ô để khách nhập địa chỉ trả cụ thể trong khu vực nội thành."
                label="Cho phép xe trung chuyển trả tận nơi khu vực nội thành"
                onChange={(value) => setSettings((current) => ({ ...current, allowDropoffTransfer: value }))}
              />
            </article>

            <article className="trip-service-section">
              <div className="trip-service-section__heading trip-service-section__heading--with-action">
                <div>
                  <strong>3. Trả khách tại điểm dừng</strong>
                  <span>Nhân viên chọn địa điểm phục vụ và nhập giờ trả.</span>
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  disabled={isLocked || !settings.allowDropoffStop}
                  onClick={addDropoffStop}
                  type="button"
                >
                  + Thêm điểm dừng
                </button>
              </div>
              <ToggleCard
                checked={settings.allowDropoffStop}
                disabled={isLocked}
                description="Khách sẽ được xổ danh sách các điểm dừng bên dưới khi đặt vé."
                label="Cho phép trả khách tại điểm dừng"
                onChange={(value) => setSettings((current) => ({ ...current, allowDropoffStop: value }))}
              />

              {settings.allowDropoffStop && (
                <div className="trip-service-point-list">
                  {dropoffStops.length === 0 ? (
                    <div className="trip-service-empty">Chưa có điểm dừng. Bấm “+ Thêm điểm dừng”.</div>
                  ) : dropoffStops.map((point, index) => (
                    <div className="trip-service-point-row" key={point.id}>
                      <label>
                        <span>Điểm dừng</span>
                        <select
                          className="form-select"
                          disabled={isLocked}
                          onChange={(event) => updateListPoint(setDropoffStops, index, 'locationId', event.target.value)}
                          value={point.locationId}
                        >
                          <option value="">Chọn địa điểm</option>
                          {availableForRow(dropoffCatalog, dropoffStops, index).map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}{location.address ? ` – ${location.address}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="trip-service-time-field">
                        <span>Giờ trả</span>
                        <input
                          className="form-control"
                          disabled={isLocked}
                          onChange={(event) => updateListPoint(setDropoffStops, index, 'estimatedTime', event.target.value)}
                          type="time"
                          value={point.estimatedTime}
                        />
                      </label>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={isLocked}
                        onClick={() => setDropoffStops((current) => current.filter((_, pointIndex) => pointIndex !== index))}
                        type="button"
                      >
                        Bỏ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </div>

        <section className="admin-panel trip-service-save-panel">
          <div>
            <strong>Điểm đi/đến chính không thay đổi ở trang này.</strong>
            <span>Muốn đổi hành trình chính, hãy quay lại “Chuyến xe” và sửa Tỉnh/Thành + địa điểm cụ thể.</span>
          </div>
          <div className="d-flex gap-2">
            <Link className="btn btn-outline-secondary" to="/admin/chuyen-xe">Hủy</Link>
            <button className="btn btn-primary" disabled={saving || isLocked} type="submit">
              {saving ? 'Đang lưu...' : 'Lưu điểm đón/trả phục vụ'}
            </button>
          </div>
        </section>
      </form>
    </>
  )
}

export default AdminTripServicePointsPage
