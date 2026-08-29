import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  createLocationArea,
  createProvince,
  createSpecificLocation,
  deleteLocationArea,
  deleteSpecificLocation,
  getLocationCatalog,
  updateLocationArea,
  updateProvince,
  updateSpecificLocation,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import './AdminLocationsStep1.css'
import {
  normalizeAddress,
  normalizeLocationName,
  normalizeProvince,
  normalizeWhitespace,
} from '../../utils/normalizers.js'

const EMPTY_PROVINCE_FORM = { name: '' }
const EMPTY_AREA_FORM = {
  provinceId: '',
  name: '',
  sortOrder: '0',
  status: 'ACTIVE',
}
const EMPTY_LOCATION_FORM = {
  provinceId: '',
  filterAreaIds: [],
  defaultAreaId: '',
  name: '',
  address: '',
  locationType: 'BOTH',
  status: 'ACTIVE',
}

const STATUS_LABELS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng',
}

const LOCATION_TYPE_LABELS = {
  PICKUP: 'Điểm đón',
  DROPOFF: 'Điểm trả',
  BOTH: 'Cả điểm đón và điểm trả',
}

const compareAreas = (left, right) => {
  const provinceCompare = String(left.province?.name || '').localeCompare(
    String(right.province?.name || ''),
    'vi',
  )
  if (provinceCompare !== 0) return provinceCompare
  const sortCompare = Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
  if (sortCompare !== 0) return sortCompare
  return String(left.name || '').localeCompare(String(right.name || ''), 'vi')
}

const compareLocations = (left, right) => {
  const provinceCompare = String(
    left.provinceRef?.name || left.province || '',
  ).localeCompare(String(right.provinceRef?.name || right.province || ''), 'vi')
  if (provinceCompare !== 0) return provinceCompare
  const areaCompare = String(left.defaultArea?.name || '').localeCompare(
    String(right.defaultArea?.name || ''),
    'vi',
  )
  if (areaCompare !== 0) return areaCompare
  return String(left.name || '').localeCompare(String(right.name || ''), 'vi')
}

const getFilterAreaIds = (location) => {
  const ids = (location.areaFilters || [])
    .map((filter) => filter.areaId || filter.area?.id)
    .filter(Boolean)
  if (location.defaultAreaId && !ids.includes(location.defaultAreaId)) {
    ids.push(location.defaultAreaId)
  }
  return [...new Set(ids)]
}

function FilterMultiSelect({
  areas,
  selectedIds,
  defaultAreaId,
  disabled,
  onToggle,
}) {
  const selectedCount = selectedIds.length
  return (
    <details className="admin-location-multiselect">
      <summary
        className={`form-select form-select-sm admin-location-multiselect__summary ${
          disabled ? 'is-disabled' : ''
        }`}
        onClick={(event) => {
          if (disabled) event.preventDefault()
        }}
      >
        {selectedCount > 0
          ? `Đã chọn ${selectedCount} bộ lọc`
          : '-- Chọn bộ lọc áp dụng --'}
      </summary>
      {!disabled && (
        <div className="admin-location-multiselect__menu">
          {areas.length === 0 ? (
            <span className="admin-location-multiselect__empty">
              Chưa có bộ lọc thuộc tỉnh/thành này.
            </span>
          ) : (
            areas.map((area) => {
              const checked = selectedIds.includes(area.id)
              const isDefault = area.id === defaultAreaId
              return (
                <label className="admin-location-multiselect__option" key={area.id}>
                  <input
                    checked={checked}
                    disabled={isDefault}
                    onChange={() => onToggle(area.id)}
                    type="checkbox"
                  />
                  <span>{area.name}</span>
                  {isDefault && <small>Mặc định</small>}
                </label>
              )
            })
          )}
        </div>
      )}
    </details>
  )
}

function AdminLocationsPage() {
  const [catalog, setCatalog] = useState({ provinces: [], areas: [], locations: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState('')

  const [provinceForm, setProvinceForm] = useState({ ...EMPTY_PROVINCE_FORM })
  const [areaForm, setAreaForm] = useState({ ...EMPTY_AREA_FORM })
  const [locationForm, setLocationForm] = useState({ ...EMPTY_LOCATION_FORM })
  const [areaDrafts, setAreaDrafts] = useState({})
  const [locationDrafts, setLocationDrafts] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getLocationCatalog()
      setCatalog({
        provinces: data?.provinces ?? [],
        areas: data?.areas ?? [],
        locations: data?.locations ?? [],
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sortedProvinces = useMemo(
    () =>
      [...catalog.provinces].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'vi'),
      ),
    [catalog.provinces],
  )
  const sortedAreas = useMemo(() => [...catalog.areas].sort(compareAreas), [catalog.areas])
  const sortedLocations = useMemo(
    () => [...catalog.locations].sort(compareLocations),
    [catalog.locations],
  )

  useEffect(() => {
    const next = {}
    for (const area of sortedAreas) {
      next[area.id] = {
        name: area.name || '',
        sortOrder: String(area.sortOrder ?? 0),
        status: area.status || 'ACTIVE',
      }
    }
    setAreaDrafts(next)
  }, [sortedAreas])

  useEffect(() => {
    const next = {}
    for (const location of sortedLocations) {
      next[location.id] = {
        provinceId: location.provinceId || location.provinceRef?.id || '',
        filterAreaIds: getFilterAreaIds(location),
        defaultAreaId: location.defaultAreaId || location.defaultArea?.id || '',
        name: location.name || '',
        address: location.address || '',
        locationType: location.locationType || 'BOTH',
        status: location.status || 'ACTIVE',
      }
    }
    setLocationDrafts(next)
  }, [sortedLocations])

  const activeProvinces = useMemo(
    () => sortedProvinces.filter((province) => province.status === 'ACTIVE'),
    [sortedProvinces],
  )

  const areasForProvince = useCallback(
    (provinceId, selectedIds = []) =>
      sortedAreas.filter(
        (area) =>
          area.provinceId === provinceId &&
          (area.status === 'ACTIVE' || selectedIds.includes(area.id)),
      ),
    [sortedAreas],
  )

  const createLocationAreas = useMemo(
    () =>
      areasForProvince(locationForm.provinceId, [
        locationForm.defaultAreaId,
        ...locationForm.filterAreaIds,
      ]),
    [areasForProvince, locationForm],
  )

  const submitProvince = async (event) => {
    event.preventDefault()
    const name = normalizeProvince(provinceForm.name)
    if (!name) {
      window.alert('Vui lòng nhập tên tỉnh/thành.')
      return
    }

    setSubmitting('province')
    try {
      await createProvince({ name })
      setProvinceForm({ ...EMPTY_PROVINCE_FORM })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const submitArea = async (event) => {
    event.preventDefault()
    const payload = {
      provinceId: areaForm.provinceId,
      name: normalizeWhitespace(areaForm.name),
      sortOrder: Number(areaForm.sortOrder || 0),
      status: areaForm.status,
    }
    if (!payload.provinceId || !payload.name) {
      window.alert('Vui lòng chọn tỉnh/thành và nhập tên bộ lọc.')
      return
    }

    setSubmitting('create-area')
    try {
      await createLocationArea(payload)
      setAreaForm({ ...EMPTY_AREA_FORM, provinceId: areaForm.provinceId })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const submitLocation = async (event) => {
    event.preventDefault()
    const filterAreaIds = [
      ...new Set([
        locationForm.defaultAreaId,
        ...locationForm.filterAreaIds,
      ].filter(Boolean)),
    ]
    const payload = {
      provinceId: locationForm.provinceId,
      filterAreaIds,
      defaultAreaId: locationForm.defaultAreaId,
      name: normalizeLocationName(locationForm.name),
      address: normalizeAddress(locationForm.address) || undefined,
      locationType: locationForm.locationType,
      status: locationForm.status,
    }

    if (!payload.provinceId || !payload.defaultAreaId || !payload.name) {
      window.alert('Vui lòng chọn tỉnh/thành, bộ lọc mặc định và nhập tên địa điểm cụ thể.')
      return
    }
    if (filterAreaIds.length === 0) {
      window.alert('Vui lòng chọn ít nhất một bộ lọc áp dụng.')
      return
    }

    setSubmitting('create-location')
    try {
      await createSpecificLocation(payload)
      setLocationForm({ ...EMPTY_LOCATION_FORM, provinceId: locationForm.provinceId })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const toggleProvinceStatus = async (province) => {
    const nextStatus = province.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const action = nextStatus === 'ACTIVE' ? 'khôi phục hoạt động' : 'ngừng hoạt động'
    if (!window.confirm(`Bạn có chắc muốn ${action} "${province.name}"?`)) return

    setSubmitting(`province:${province.id}`)
    try {
      await updateProvince(province.id, { status: nextStatus })
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const updateAreaDraft = (areaId, field, value) => {
    setAreaDrafts((current) => ({
      ...current,
      [areaId]: { ...current[areaId], [field]: value },
    }))
  }

  const saveAreaRow = async (area) => {
    const draft = areaDrafts[area.id]
    if (!draft) return
    const payload = {
      name: normalizeWhitespace(draft.name),
      sortOrder: Number(draft.sortOrder || 0),
      status: draft.status,
    }
    if (!payload.name) {
      window.alert('Tên bộ lọc không được để trống.')
      return
    }

    setSubmitting(`area:${area.id}`)
    try {
      await updateLocationArea(area.id, payload)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const removeAreaRow = async (area) => {
    if (!window.confirm(`Xóa mềm bộ lọc "${area.name}"?\n\nBản ghi sẽ được giữ trong cơ sở dữ liệu nhưng không còn dùng cho dữ liệu mới.`)) {
      return
    }
    setSubmitting(`delete-area:${area.id}`)
    try {
      await deleteLocationArea(area.id)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const updateLocationDraft = (locationId, field, value) => {
    setLocationDrafts((current) => {
      const draft = current[locationId] || {}
      return {
        ...current,
        [locationId]: {
          ...draft,
          [field]: value,
          ...(field === 'provinceId'
            ? { defaultAreaId: '', filterAreaIds: [] }
            : {}),
        },
      }
    })
  }

  const toggleLocationDraftFilter = (locationId, areaId) => {
    setLocationDrafts((current) => {
      const draft = current[locationId] || {}
      if (draft.defaultAreaId === areaId) return current
      const selected = draft.filterAreaIds || []
      return {
        ...current,
        [locationId]: {
          ...draft,
          filterAreaIds: selected.includes(areaId)
            ? selected.filter((id) => id !== areaId)
            : [...selected, areaId],
        },
      }
    })
  }

  const saveLocationRow = async (location) => {
    const draft = locationDrafts[location.id]
    if (!draft) return
    const filterAreaIds = [
      ...new Set([draft.defaultAreaId, ...(draft.filterAreaIds || [])].filter(Boolean)),
    ]
    const payload = {
      provinceId: draft.provinceId,
      filterAreaIds,
      defaultAreaId: draft.defaultAreaId,
      name: normalizeLocationName(draft.name),
      address: normalizeAddress(draft.address) || null,
      locationType: draft.locationType,
      status: draft.status,
    }
    if (!payload.provinceId || !payload.defaultAreaId || !payload.name) {
      window.alert('Tỉnh/thành, bộ lọc mặc định và tên địa điểm cụ thể không được để trống.')
      return
    }

    setSubmitting(`location:${location.id}`)
    try {
      await updateSpecificLocation(location.id, payload)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  const removeLocationRow = async (location) => {
    if (!window.confirm(`Xóa mềm địa điểm "${location.name}"?\n\nĐịa điểm sẽ biến mất khỏi trang quản lý và dữ liệu mới, nhưng lịch sử chuyến/vé cũ vẫn được giữ.`)) {
      return
    }
    setSubmitting(`delete-location:${location.id}`)
    try {
      await deleteSpecificLocation(location.id)
      await load()
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setSubmitting('')
    }
  }

  if (loading && catalog.provinces.length === 0) return <LoadingState />
  if (error && catalog.provinces.length === 0) {
    return <ErrorState message={error} onRetry={load} />
  }

  return (
    <>
      <AdminPageHeader
        title="Quản lý tỉnh/thành và địa điểm"
        description="Tỉnh/thành là dữ liệu gốc. Bộ lọc dùng cho tìm chuyến; địa điểm cụ thể dùng cho hành trình và các điểm phục vụ."
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="admin-panel admin-location-top-panel admin-location-top-panel--compact">
        <div className="admin-location-top-grid admin-location-top-grid--compact">
          <div className="admin-location-province-create">
            <div className="admin-location-card__header">
              <div>
                <h2>Thêm tỉnh/thành</h2>
                <p>Nguồn dữ liệu gốc dùng cho toàn bộ địa điểm.</p>
              </div>
            </div>
            <form className="admin-location-inline-form admin-location-inline-form--province" onSubmit={submitProvince}>
              <input
                className="form-control form-control-sm"
                maxLength="100"
                placeholder="Ví dụ: Đắk Lắk"
                required
                value={provinceForm.name}
                onChange={(event) => setProvinceForm({ name: event.target.value })}
                onBlur={(event) => setProvinceForm({ name: normalizeProvince(event.target.value) })}
              />
              <button className="btn btn-primary btn-sm" disabled={submitting === 'province'} type="submit">
                {submitting === 'province' ? '...' : 'Thêm'}
              </button>
            </form>
          </div>

          <div className="admin-location-province-manage">
            <div className="admin-location-card__header">
              <div>
                <h2>Danh sách tỉnh/thành</h2>
                <p>{sortedProvinces.length} tỉnh/thành đã khai báo.</p>
              </div>
            </div>
            <div className="admin-location-province-simple-list">
              {sortedProvinces.length === 0 ? (
                <EmptyState message="Chưa có tỉnh/thành." />
              ) : (
                sortedProvinces.map((province) => (
                  <div className="admin-location-province-simple-row" key={province.id}>
                    <div className="admin-location-province-simple-info">
                      <strong>{province.name}</strong>
                      <small>Mã tỉnh: {province.id.slice(0, 8)}</small>
                    </div>
                    <button
                      className={`admin-location-province-status-btn ${province.status === 'ACTIVE' ? 'is-active' : 'is-inactive'}`}
                      disabled={submitting === `province:${province.id}`}
                      onClick={() => toggleProvinceStatus(province)}
                      type="button"
                    >
                      {submitting === `province:${province.id}` ? '...' : STATUS_LABELS[province.status]}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="admin-location-two-columns admin-location-two-columns--compact">
        <article className="admin-panel admin-location-column">
          <div className="admin-location-card__header">
            <div>
              <h2>Bộ lọc địa điểm</h2>
              <p>Bộ lọc thuộc tỉnh/thành, có thứ tự và trạng thái riêng.</p>
            </div>
          </div>

          <form className="admin-location-compact-form admin-location-compact-form--area admin-location-compact-form--area-new" onSubmit={submitArea}>
            <select className="form-select form-select-sm" required value={areaForm.provinceId} onChange={(event) => setAreaForm((current) => ({ ...current, provinceId: event.target.value }))}>
              <option value="">-- Tỉnh/Thành --</option>
              {activeProvinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
            </select>
            <input className="form-control form-control-sm" maxLength="150" placeholder="Tên bộ lọc" required value={areaForm.name} onChange={(event) => setAreaForm((current) => ({ ...current, name: event.target.value }))} />
            <input className="form-control form-control-sm" min="0" placeholder="Thứ tự" type="number" value={areaForm.sortOrder} onChange={(event) => setAreaForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            <select className="form-select form-select-sm" value={areaForm.status} onChange={(event) => setAreaForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng</option>
            </select>
            <button className="btn btn-primary btn-sm" disabled={submitting === 'create-area'} type="submit">{submitting === 'create-area' ? '...' : 'Thêm'}</button>
          </form>

          <div className="admin-table-wrap admin-location-scroll-wrap mt-3">
            <table className="admin-table admin-location-table admin-location-table--tight admin-location-table--areas-step1">
              <thead>
                <tr>
                  <th>Tỉnh/Thành</th>
                  <th>Tên bộ lọc</th>
                  <th>Thứ tự</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedAreas.map((area) => {
                  const draft = areaDrafts[area.id] || {}
                  return (
                    <tr key={area.id}>
                      <td>{area.province?.name || '—'}</td>
                      <td><input className="form-control form-control-sm" value={draft.name || ''} onChange={(event) => updateAreaDraft(area.id, 'name', event.target.value)} /></td>
                      <td><input className="form-control form-control-sm admin-location-sort-input" min="0" type="number" value={draft.sortOrder ?? '0'} onChange={(event) => updateAreaDraft(area.id, 'sortOrder', event.target.value)} /></td>
                      <td>
                        <select className="form-select form-select-sm" value={draft.status || 'ACTIVE'} onChange={(event) => updateAreaDraft(area.id, 'status', event.target.value)}>
                          <option value="ACTIVE">Hoạt động</option>
                          <option value="INACTIVE">Ngừng</option>
                        </select>
                      </td>
                      <td>
                        <div className="admin-location-row-actions">
                          <button className="btn btn-outline-danger btn-sm" disabled={submitting === `area:${area.id}`} onClick={() => saveAreaRow(area)} type="button">{submitting === `area:${area.id}` ? '...' : 'Lưu'}</button>
                          <button className="btn btn-outline-secondary btn-sm" disabled={submitting === `delete-area:${area.id}`} onClick={() => removeAreaRow(area)} type="button">{submitting === `delete-area:${area.id}` ? '...' : 'Xóa'}</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-panel admin-location-column">
          <div className="admin-location-card__header">
            <div>
              <h2>Địa điểm cụ thể</h2>
              <p>Một địa điểm có thể thuộc nhiều bộ lọc cùng tỉnh; bộ lọc mặc định luôn nằm trong danh sách áp dụng.</p>
            </div>
          </div>

          <form className="admin-location-specific-create-step1" onSubmit={submitLocation}>
            <div className="admin-location-specific-create-step1__top">
              <label>
                <span>Tỉnh/Thành</span>
                <select className="form-select form-select-sm" required value={locationForm.provinceId} onChange={(event) => {
                  const provinceId = event.target.value
                  setLocationForm((current) => ({ ...current, provinceId, filterAreaIds: [], defaultAreaId: '' }))
                }}>
                  <option value="">-- Tỉnh/Thành --</option>
                  {activeProvinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
                </select>
              </label>

              <label>
                <span>Bộ lọc áp dụng</span>
                <FilterMultiSelect
                  areas={createLocationAreas}
                  defaultAreaId={locationForm.defaultAreaId}
                  disabled={!locationForm.provinceId}
                  selectedIds={locationForm.filterAreaIds}
                  onToggle={(areaId) => setLocationForm((current) => ({
                    ...current,
                    filterAreaIds: current.filterAreaIds.includes(areaId)
                      ? current.filterAreaIds.filter((id) => id !== areaId)
                      : [...current.filterAreaIds, areaId],
                  }))}
                />
              </label>

              <label>
                <span>Bộ lọc mặc định</span>
                <select className="form-select form-select-sm" disabled={!locationForm.provinceId} required value={locationForm.defaultAreaId} onChange={(event) => {
                  const defaultAreaId = event.target.value
                  setLocationForm((current) => ({
                    ...current,
                    defaultAreaId,
                    filterAreaIds: defaultAreaId && !current.filterAreaIds.includes(defaultAreaId)
                      ? [...current.filterAreaIds, defaultAreaId]
                      : current.filterAreaIds,
                  }))
                }}>
                  <option value="">-- Chọn mặc định --</option>
                  {createLocationAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
              </label>
            </div>

            <div className="admin-location-specific-create-step1__bottom">
              <label>
                <span>Loại địa điểm</span>
                <select className="form-select form-select-sm" value={locationForm.locationType} onChange={(event) => setLocationForm((current) => ({ ...current, locationType: event.target.value }))}>
                  {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Tên địa điểm cụ thể</span>
                <input className="form-control form-control-sm" maxLength="200" placeholder="Ví dụ: Bến xe An Sương" required value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} onBlur={(event) => setLocationForm((current) => ({ ...current, name: normalizeLocationName(event.target.value) }))} />
              </label>
              <label>
                <span>Địa chỉ chi tiết</span>
                <input className="form-control form-control-sm" maxLength="300" placeholder="Địa chỉ chi tiết" value={locationForm.address} onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))} onBlur={(event) => setLocationForm((current) => ({ ...current, address: normalizeAddress(event.target.value) }))} />
              </label>
              <label>
                <span>Trạng thái</span>
                <select className="form-select form-select-sm" value={locationForm.status} onChange={(event) => setLocationForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Ngừng</option>
                </select>
              </label>
              <button className="btn btn-primary btn-sm admin-location-create-button" disabled={submitting === 'create-location'} type="submit">{submitting === 'create-location' ? '...' : '+'}</button>
            </div>
          </form>

          <div className="admin-table-wrap admin-location-scroll-wrap mt-3">
            <table className="admin-table admin-location-table admin-location-table--tight admin-location-table--locations-step1">
              <thead>
                <tr>
                  <th>Tỉnh/Thành</th>
                  <th>Bộ lọc áp dụng</th>
                  <th>Bộ lọc mặc định</th>
                  <th>Địa điểm cụ thể</th>
                  <th>Địa chỉ</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedLocations.map((location) => {
                  const draft = locationDrafts[location.id] || {}
                  const areaOptions = areasForProvince(draft.provinceId, [draft.defaultAreaId, ...(draft.filterAreaIds || [])])
                  return (
                    <tr key={location.id}>
                      <td>
                        <select className="form-select form-select-sm" value={draft.provinceId || ''} onChange={(event) => updateLocationDraft(location.id, 'provinceId', event.target.value)}>
                          {sortedProvinces.filter((province) => province.status === 'ACTIVE' || province.id === draft.provinceId).map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <FilterMultiSelect
                          areas={areaOptions}
                          defaultAreaId={draft.defaultAreaId}
                          selectedIds={draft.filterAreaIds || []}
                          onToggle={(areaId) => toggleLocationDraftFilter(location.id, areaId)}
                        />
                      </td>
                      <td>
                        <select className="form-select form-select-sm" value={draft.defaultAreaId || ''} onChange={(event) => {
                          const defaultAreaId = event.target.value
                          setLocationDrafts((current) => {
                            const row = current[location.id] || {}
                            return {
                              ...current,
                              [location.id]: {
                                ...row,
                                defaultAreaId,
                                filterAreaIds: defaultAreaId && !(row.filterAreaIds || []).includes(defaultAreaId)
                                  ? [...(row.filterAreaIds || []), defaultAreaId]
                                  : row.filterAreaIds || [],
                              },
                            }
                          })
                        }}>
                          <option value="">-- Chọn --</option>
                          {areaOptions.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                        </select>
                      </td>
                      <td><input className="form-control form-control-sm" value={draft.name || ''} onChange={(event) => updateLocationDraft(location.id, 'name', event.target.value)} /></td>
                      <td><input className="form-control form-control-sm" value={draft.address || ''} onChange={(event) => updateLocationDraft(location.id, 'address', event.target.value)} /></td>
                      <td>
                        <select className="form-select form-select-sm" value={draft.locationType || 'BOTH'} onChange={(event) => updateLocationDraft(location.id, 'locationType', event.target.value)}>
                          {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-select form-select-sm" value={draft.status || 'ACTIVE'} onChange={(event) => updateLocationDraft(location.id, 'status', event.target.value)}>
                          <option value="ACTIVE">Hoạt động</option>
                          <option value="INACTIVE">Ngừng</option>
                        </select>
                      </td>
                      <td>
                        <div className="admin-location-row-actions">
                          <button className="btn btn-outline-danger btn-sm" disabled={submitting === `location:${location.id}`} onClick={() => saveLocationRow(location)} type="button">{submitting === `location:${location.id}` ? '...' : 'Lưu'}</button>
                          <button className="btn btn-outline-secondary btn-sm" disabled={submitting === `delete-location:${location.id}`} onClick={() => removeLocationRow(location)} type="button">{submitting === `delete-location:${location.id}` ? '...' : 'Xóa'}</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  )
}

export default AdminLocationsPage
