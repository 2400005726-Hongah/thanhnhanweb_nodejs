import './BookingServicePointFields.css'

const formatPoint = (point) => {
  if (!point?.location) return 'Chưa xác định'
  return [point.location.name, point.location.address].filter(Boolean).join(' – ')
}

const formatServiceTime = (value) => {
  if (!value) return ''
  const match = String(value).match(/(?:T|^)(\d{2}:\d{2})/)
  return match?.[1] || String(value).slice(0, 5)
}

const createDefaultServiceSelection = () => ({
  pickupKind: 'DiemChinh',
  pickupServicePointId: '',
  pickupRequestedAddress: '',
  dropoffKind: 'DiemChinh',
  dropoffServicePointId: '',
  dropoffRequestedAddress: '',
})

const validateServiceSelection = (serviceData, selection) => {
  if (!serviceData) return 'Không thể xác định phương án điểm đón/trả của chuyến.'

  if (selection.pickupKind === 'DiemHen' && !selection.pickupServicePointId) {
    return 'Vui lòng chọn điểm hẹn đón khách.'
  }
  if (
    selection.pickupKind === 'TrungChuyen' &&
    selection.pickupRequestedAddress.trim().length < 5
  ) {
    return 'Vui lòng nhập địa chỉ đón cụ thể cho xe trung chuyển.'
  }
  if (selection.dropoffKind === 'DiemDung' && !selection.dropoffServicePointId) {
    return 'Vui lòng chọn điểm dừng trả khách.'
  }
  if (
    selection.dropoffKind === 'TrungChuyen' &&
    selection.dropoffRequestedAddress.trim().length < 5
  ) {
    return 'Vui lòng nhập địa chỉ trả cụ thể cho xe trung chuyển.'
  }

  return ''
}

function BookingOption({ checked, description, label, name, onChange, value }) {
  return (
    <label className={`booking-service-option ${checked ? 'is-selected' : ''}`}>
      <input
        checked={checked}
        name={name}
        onChange={() => onChange(value)}
        type="radio"
        value={value}
      />
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  )
}

function BookingServicePointFields({
  serviceData,
  selection,
  onChange,
  compact = false,
}) {
  const pickupPoints = serviceData?.pickupPoints ?? []
  const dropoffPoints = serviceData?.dropoffPoints ?? []
  const primaryPickup = pickupPoints.find((point) => point.kind === 'DiemChinh')
  const primaryDropoff = dropoffPoints.find((point) => point.kind === 'DiemChinh')
  const meetingPoints = pickupPoints.filter((point) => point.kind === 'DiemHen')
  const dropoffStops = dropoffPoints.filter((point) => point.kind === 'DiemDung')
  const trip = serviceData?.trip

  const primaryPickupLabel =
    trip?.primaryPickupMode === 'TaiVanPhong'
      ? 'Tập trung tại văn phòng nhà xe'
      : 'Đón trực tiếp tại bến xe trung tâm thành phố'
  const primaryPickupDescription =
    trip?.primaryPickupMode === 'TaiVanPhong'
      ? 'Hành khách cần có mặt trước giờ xuất bến tối thiểu 30 phút.'
      : 'Vui lòng chủ động đợi xe tại khu vực cột đón khách của nhà xe.'

  const primaryDropoffLabel =
    trip?.primaryDropoffMode === 'TraTaiVanPhong'
      ? 'Trả khách tại văn phòng nhà xe'
      : 'Trả khách tại bến xe trung tâm đích đến'
  const primaryDropoffDescription =
    trip?.primaryDropoffMode === 'TraTaiVanPhong'
      ? 'Khách xuống xe tại văn phòng nhà xe ở điểm đến.'
      : 'Khách xuống xe tại bến xe trung tâm của điểm đến.'

  const setField = (field, value) => onChange({ ...selection, [field]: value })

  const changePickupKind = (kind) => {
    onChange({
      ...selection,
      pickupKind: kind,
      pickupServicePointId: kind === 'DiemHen' ? meetingPoints[0]?.id || '' : '',
      pickupRequestedAddress:
        kind === 'TrungChuyen' ? selection.pickupRequestedAddress : '',
    })
  }

  const changeDropoffKind = (kind) => {
    onChange({
      ...selection,
      dropoffKind: kind,
      dropoffServicePointId: kind === 'DiemDung' ? dropoffStops[0]?.id || '' : '',
      dropoffRequestedAddress:
        kind === 'TrungChuyen' ? selection.dropoffRequestedAddress : '',
    })
  }

  const wrapperClass = compact
    ? 'booking-service-grid booking-service-grid--compact'
    : 'booking-service-grid'

  return (
    <div className={wrapperClass}>
      <section className="booking-service-card booking-service-card--pickup">
        <div className="booking-service-card__heading">
          <strong>Điểm đón</strong>
          <small>{formatPoint(primaryPickup)}</small>
        </div>

        <div className="booking-service-options">
          <BookingOption
            checked={selection.pickupKind === 'DiemChinh'}
            description={primaryPickupDescription}
            label={primaryPickupLabel}
            name="pickupKind"
            onChange={changePickupKind}
            value="DiemChinh"
          />

          {trip?.allowPickupTransfer && (
            <BookingOption
              checked={selection.pickupKind === 'TrungChuyen'}
              description="Nhập địa chỉ cụ thể để nhà xe bố trí xe trung chuyển đón khách."
              label="Xe trung chuyển đón khách"
              name="pickupKind"
              onChange={changePickupKind}
              value="TrungChuyen"
            />
          )}

          {trip?.allowPickupMeetingPoint && meetingPoints.length > 0 && (
            <BookingOption
              checked={selection.pickupKind === 'DiemHen'}
              description="Chọn một trong các điểm hẹn và giờ đón do nhà xe đã cấu hình."
              label="Đón khách tại điểm hẹn"
              name="pickupKind"
              onChange={changePickupKind}
              value="DiemHen"
            />
          )}
        </div>

        {selection.pickupKind === 'TrungChuyen' && (
          <div className="booking-service-detail">
            <label className="form-label">Địa chỉ cần đón</label>
            <input
              className="form-control"
              maxLength="500"
              placeholder="Ví dụ: 123 Nguyễn Tất Thành, phường..."
              value={selection.pickupRequestedAddress}
              onChange={(event) => setField('pickupRequestedAddress', event.target.value)}
              required
            />
            <small>Nhập địa chỉ càng cụ thể càng tốt để nhà xe sắp xếp trung chuyển.</small>
          </div>
        )}

        {selection.pickupKind === 'DiemHen' && (
          <div className="booking-service-detail">
            <label className="form-label">Điểm hẹn đón khách</label>
            <select
              className="form-select"
              value={selection.pickupServicePointId}
              onChange={(event) => setField('pickupServicePointId', event.target.value)}
              required
            >
              <option value="">-- Chọn điểm hẹn --</option>
              {meetingPoints.map((point) => {
                const time = formatServiceTime(point.estimatedTime)
                return (
                  <option key={point.id} value={point.id}>
                    {formatPoint(point)}{time ? ` – ${time}` : ''}
                  </option>
                )
              })}
            </select>
            {selection.pickupServicePointId && (() => {
              const selected = meetingPoints.find((point) => point.id === selection.pickupServicePointId)
              const time = formatServiceTime(selected?.estimatedTime)
              return time ? <small>Giờ đón dự kiến: <strong>{time}</strong></small> : null
            })()}
          </div>
        )}
      </section>

      <section className="booking-service-card booking-service-card--dropoff">
        <div className="booking-service-card__heading">
          <strong>Điểm trả</strong>
          <small>{formatPoint(primaryDropoff)}</small>
        </div>

        <div className="booking-service-options">
          <BookingOption
            checked={selection.dropoffKind === 'DiemChinh'}
            description={primaryDropoffDescription}
            label={primaryDropoffLabel}
            name="dropoffKind"
            onChange={changeDropoffKind}
            value="DiemChinh"
          />

          {trip?.allowDropoffTransfer && (
            <BookingOption
              checked={selection.dropoffKind === 'TrungChuyen'}
              description="Nhập địa chỉ cụ thể trong khu vực nội thành để nhà xe bố trí trung chuyển."
              label="Xe trung chuyển trả tận nơi khu vực nội thành"
              name="dropoffKind"
              onChange={changeDropoffKind}
              value="TrungChuyen"
            />
          )}

          {trip?.allowDropoffStop && dropoffStops.length > 0 && (
            <BookingOption
              checked={selection.dropoffKind === 'DiemDung'}
              description="Chọn một trong các điểm dừng và giờ trả do nhà xe đã cấu hình."
              label="Trả khách tại điểm dừng"
              name="dropoffKind"
              onChange={changeDropoffKind}
              value="DiemDung"
            />
          )}
        </div>

        {selection.dropoffKind === 'TrungChuyen' && (
          <div className="booking-service-detail">
            <label className="form-label">Địa chỉ cần trả</label>
            <input
              className="form-control"
              maxLength="500"
              placeholder="Ví dụ: 456 Phan Văn Trị, phường..."
              value={selection.dropoffRequestedAddress}
              onChange={(event) => setField('dropoffRequestedAddress', event.target.value)}
              required
            />
            <small>Phương án trung chuyển chỉ áp dụng trong phạm vi nhà xe phục vụ.</small>
          </div>
        )}

        {selection.dropoffKind === 'DiemDung' && (
          <div className="booking-service-detail">
            <label className="form-label">Điểm dừng trả khách</label>
            <select
              className="form-select"
              value={selection.dropoffServicePointId}
              onChange={(event) => setField('dropoffServicePointId', event.target.value)}
              required
            >
              <option value="">-- Chọn điểm dừng --</option>
              {dropoffStops.map((point) => {
                const time = formatServiceTime(point.estimatedTime)
                return (
                  <option key={point.id} value={point.id}>
                    {formatPoint(point)}{time ? ` – ${time}` : ''}
                  </option>
                )
              })}
            </select>
            {selection.dropoffServicePointId && (() => {
              const selected = dropoffStops.find((point) => point.id === selection.dropoffServicePointId)
              const time = formatServiceTime(selected?.estimatedTime)
              return time ? <small>Giờ trả dự kiến: <strong>{time}</strong></small> : null
            })()}
          </div>
        )}
      </section>
    </div>
  )
}

export {
  createDefaultServiceSelection,
  validateServiceSelection,
}
export default BookingServicePointFields
