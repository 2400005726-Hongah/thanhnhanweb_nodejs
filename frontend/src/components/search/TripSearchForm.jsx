import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getApiErrorMessage } from '../../services/apiClient.js'
import { getLocations } from '../../services/publicTrip.service.js'
import { getVietnamToday } from '../../utils/formatDateTime.js'

const emptyForm = { departureLocationId: '', arrivalLocationId: '', departureDate: '' }

function TripSearchForm({ initialValues = emptyForm, compact = false }) {
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [form, setForm] = useState({ ...emptyForm, ...initialValues })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const today = getVietnamToday()
  const initialDeparture = initialValues.departureLocationId
  const initialArrival = initialValues.arrivalLocationId
  const initialDate = initialValues.departureDate

  useEffect(() => {
    let active = true
    setLoading(true)
    getLocations()
      .then((data) => active && setLocations(data.locations))
      .catch((requestError) => active && setError(getApiErrorMessage(requestError)))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      departureLocationId: initialDeparture,
      arrivalLocationId: initialArrival,
      departureDate: initialDate,
    }))
  }, [initialDeparture, initialArrival, initialDate])

  const update = (event) => {
    setValidation('')
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.departureLocationId || !form.arrivalLocationId || !form.departureDate) {
      setValidation('Vui lòng chọn đầy đủ điểm đi, điểm đến và ngày đi.')
      return
    }
    if (form.departureLocationId === form.arrivalLocationId) {
      setValidation('Điểm đi phải khác điểm đến.')
      return
    }
    if (form.departureDate < today) {
      setValidation('Ngày đi không được trước ngày hiện tại.')
      return
    }

    navigate(`/tim-chuyen?${new URLSearchParams(form).toString()}`)
  }

  return (
    <form className={`trip-search-form${compact ? ' trip-search-form--compact' : ''}`} onSubmit={submit}>
      <div className="search-form-heading">
        <span className="eyebrow">{compact ? 'ĐẶT CHỖ TRỰC TUYẾN' : 'HỆ THỐNG MUA VÉ TRỰC TUYẾN TỰ ĐỘNG'}</span>
        <h2>Tìm chuyến xe phù hợp</h2>
      </div>
      {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
      <div className="row g-3 align-items-end">
        <div className="col-md-6 col-lg-4">
          <label className="form-label" htmlFor="departureLocationId">Điểm đi</label>
          <select id="departureLocationId" name="departureLocationId" className="form-select" value={form.departureLocationId} onChange={update} disabled={loading}>
            <option value="">{loading ? 'Đang tải địa điểm...' : 'Chọn điểm đi'}</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name} — {location.province}</option>)}
          </select>
        </div>
        <div className="col-md-6 col-lg-4">
          <label className="form-label" htmlFor="arrivalLocationId">Điểm đến</label>
          <select id="arrivalLocationId" name="arrivalLocationId" className="form-select" value={form.arrivalLocationId} onChange={update} disabled={loading}>
            <option value="">{loading ? 'Đang tải địa điểm...' : 'Chọn điểm đến'}</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name} — {location.province}</option>)}
          </select>
        </div>
        <div className="col-md-6 col-lg-2">
          <label className="form-label" htmlFor="departureDate">Ngày đi</label>
          <input id="departureDate" name="departureDate" type="date" min={today} className="form-control" value={form.departureDate} onChange={update} />
        </div>
        <div className="col-md-6 col-lg-2 d-grid">
          <button type="submit" className="btn btn-warning btn-search" disabled={loading}>{compact ? 'Tìm chuyến' : 'Tìm kiếm chuyến xe'}</button>
        </div>
      </div>
      {validation && <p className="form-error" role="alert">{validation}</p>}
    </form>
  )
}

export default TripSearchForm
