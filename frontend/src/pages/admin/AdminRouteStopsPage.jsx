import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import { ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import {
  configureRouteStops,
  getLocationCatalog,
  getRoute,
  getRouteStops,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'

const serializeStop = (stop, index) => ({
  id: stop.id || `new-${Date.now()}-${index}`,
  areaId: stop.areaId || stop.area?.id || '',
  pointType: stop.pointType || 'PICKUP',
  sortOrder: String(stop.sortOrder ?? index),
  status: stop.status || 'ACTIVE',
})

function AdminRouteStopsPage() {
  const { routeId } = useParams()
  const [route, setRoute] = useState(null)
  const [catalog, setCatalog] = useState({ areas: [] })
  const [stops, setStops] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [routeData, catalogData, stopData] = await Promise.all([
        getRoute(routeId),
        getLocationCatalog(),
        getRouteStops(routeId),
      ])
      setRoute(routeData?.route || routeData)
      setCatalog({ areas: catalogData?.areas ?? [] })
      setStops((stopData?.stops ?? []).map(serializeStop))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [routeId])

  useEffect(() => {
    load()
  }, [load])

  const departureProvinceId =
    route?.departureLocation?.provinceId || route?.departureLocation?.provinceRef?.id || ''
  const arrivalProvinceId =
    route?.arrivalLocation?.provinceId || route?.arrivalLocation?.provinceRef?.id || ''

  const activeAreas = useMemo(
    () => catalog.areas.filter((area) => area.status === 'ACTIVE'),
    [catalog.areas],
  )

  const areaOptionsFor = (pointType, currentAreaId, index) => {
    const expectedProvinceId = pointType === 'PICKUP' ? departureProvinceId : arrivalProvinceId
    return catalog.areas.filter((area) => {
      const provinceMatches = !expectedProvinceId || area.provinceId === expectedProvinceId
      const statusMatches = area.status === 'ACTIVE' || area.id === currentAreaId
      const unused = !stops.some(
        (stop, stopIndex) =>
          stopIndex !== index && stop.pointType === pointType && stop.areaId === area.id,
      )
      return provinceMatches && statusMatches && unused
    })
  }

  const addStop = (pointType) => {
    const expectedProvinceId = pointType === 'PICKUP' ? departureProvinceId : arrivalProvinceId
    const used = new Set(
      stops.filter((stop) => stop.pointType === pointType).map((stop) => stop.areaId),
    )
    const area = activeAreas.find(
      (candidate) =>
        (!expectedProvinceId || candidate.provinceId === expectedProvinceId) &&
        !used.has(candidate.id),
    )

    if (!area) {
      window.alert(`Không còn khu vực ${pointType === 'PICKUP' ? 'đón' : 'trả'} phù hợp để thêm.`)
      return
    }

    setStops((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        areaId: area.id,
        pointType,
        sortOrder: String(current.filter((stop) => stop.pointType === pointType).length),
        status: 'ACTIVE',
      },
    ])
  }

  const updateStop = (index, field, value) => {
    setStops((current) =>
      current.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [field]: value } : stop,
      ),
    )
  }

  const removeStop = (index) => {
    setStops((current) => current.filter((_, stopIndex) => stopIndex !== index))
  }

  const save = async (event) => {
    event.preventDefault()
    if (stops.some((stop) => !stop.areaId || !stop.pointType)) {
      window.alert('Vui lòng chọn đầy đủ khu vực đón/trả.')
      return
    }

    setSaving(true)
    try {
      await configureRouteStops(routeId, {
        stops: stops.map((stop, index) => ({
          areaId: stop.areaId,
          pointType: stop.pointType,
          sortOrder: Number(stop.sortOrder || index),
          status: stop.status,
        })),
      })
      window.alert('Đã lưu cấu hình khu vực đón/trả của tuyến.')
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
        title="Cấu hình điểm dừng tuyến"
        description="Chọn các khu vực/bộ lọc mà tuyến cho phép đón và trả khách. Chuyến cụ thể sẽ chọn địa điểm phục vụ chi tiết từ danh mục này."
        actions={(
          <Link className="btn btn-outline-secondary" to="/admin/chuyen-xe">
            ← Quay lại tuyến đường
          </Link>
        )}
      />

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span>TUYẾN ĐƯỜNG</span>
            <h2>{route?.routeName || 'Chưa cập nhật'}</h2>
          </div>
        </div>
        <div className="row g-3">
          <div className="col-md-6"><strong>Điểm đi:</strong> {route?.departureLocation?.name || '—'} – {route?.departureLocation?.province || '—'}</div>
          <div className="col-md-6"><strong>Điểm đến:</strong> {route?.arrivalLocation?.name || '—'} – {route?.arrivalLocation?.province || '—'}</div>
        </div>
      </section>

      <form onSubmit={save}>
        {['PICKUP', 'DROPOFF'].map((pointType) => {
          const title = pointType === 'PICKUP' ? 'Khu vực đón' : 'Khu vực trả'
          const rows = stops.map((stop, index) => ({ stop, index })).filter(({ stop }) => stop.pointType === pointType)
          return (
            <section className="admin-panel" key={pointType}>
              <div className="admin-panel-heading">
                <div><span>{pointType === 'PICKUP' ? 'CHIỀU ĐI' : 'CHIỀU ĐẾN'}</span><h2>{title}</h2></div>
                <button className="btn btn-outline-primary" onClick={() => addStop(pointType)} type="button">
                  + Thêm {title.toLowerCase()}
                </button>
              </div>

              {rows.length === 0 ? (
                <div className="alert alert-light border mb-0">Chưa cấu hình {title.toLowerCase()}.</div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>STT</th><th>Khu vực/Bộ lọc</th><th>Tỉnh/Thành</th><th>Thứ tự</th><th>Thao tác</th></tr></thead>
                    <tbody>
                      {rows.map(({ stop, index }, rowIndex) => (
                        <tr key={stop.id}>
                          <td>{rowIndex + 1}</td>
                          <td>
                            <select className="form-select" value={stop.areaId} onChange={(event) => updateStop(index, 'areaId', event.target.value)}>
                              <option value="">Chọn khu vực</option>
                              {areaOptionsFor(stop.pointType, stop.areaId, index).map((area) => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>{catalog.areas.find((area) => area.id === stop.areaId)?.province?.name || '—'}</td>
                          <td><input className="form-control" min="0" type="number" value={stop.sortOrder} onChange={(event) => updateStop(index, 'sortOrder', event.target.value)} /></td>
                          <td><button className="btn btn-sm btn-outline-danger" onClick={() => removeStop(index)} type="button">Bỏ</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })}

        <section className="admin-panel">
          <div className="d-flex justify-content-end gap-2">
            <Link className="btn btn-outline-secondary" to="/admin/chuyen-xe">Hủy</Link>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? 'Đang lưu...' : 'Lưu cấu hình điểm dừng tuyến'}
            </button>
          </div>
        </section>
      </form>
    </>
  )
}

export default AdminRouteStopsPage
