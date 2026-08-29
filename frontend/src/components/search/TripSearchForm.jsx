import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getApiErrorMessage } from '../../services/apiClient.js'
import { getTripSearchCatalog } from '../../services/publicTrip.service.js'
import { getVietnamToday } from '../../utils/formatDateTime.js'

const emptyForm = {
  departureProvinceId: '',
  arrivalProvinceId: '',
  departureDate: '',
}

function TripSearchForm({ initialValues = emptyForm, compact = false }) {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState({ provinces: [] })
  const [form, setForm] = useState({ ...emptyForm, ...initialValues })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const today = getVietnamToday()

  const initialDeparture = initialValues.departureProvinceId
  const initialArrival = initialValues.arrivalProvinceId
  const initialDate = initialValues.departureDate

  useEffect(() => {
    let active = true
    setLoading(true)
    getTripSearchCatalog()
      .then((data) => active && setCatalog({ provinces: data?.provinces ?? [] }))
      .catch((requestError) => active && setError(getApiErrorMessage(requestError)))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      departureProvinceId: initialDeparture || '',
      arrivalProvinceId: initialArrival || '',
      departureDate: initialDate || '',
    }))
  }, [initialDeparture, initialArrival, initialDate])

  const arrivalProvinces = useMemo(
    () =>
      catalog.provinces.filter(
        (province) => province.id !== form.departureProvinceId,
      ),
    [catalog.provinces, form.departureProvinceId],
  )

  const update = (event) => {
    const { name, value } = event.target
    setValidation('')

    setForm((current) => {
      if (name === 'departureProvinceId') {
        return {
          ...current,
          departureProvinceId: value,
          arrivalProvinceId:
            current.arrivalProvinceId === value ? '' : current.arrivalProvinceId,
        }
      }
      return { ...current, [name]: value }
    })
  }

  const submit = (event) => {
    event.preventDefault()

    if (
      !form.departureProvinceId ||
      !form.arrivalProvinceId ||
      !form.departureDate
    ) {
      setValidation(
        'Vui lòng chọn đầy đủ Tỉnh/Thành đi, Tỉnh/Thành đến và ngày đi.',
      )
      return
    }

    if (form.departureProvinceId === form.arrivalProvinceId) {
      setValidation('Tỉnh/Thành đi phải khác Tỉnh/Thành đến.')
      return
    }

    if (form.departureDate < today) {
      setValidation('Ngày đi không được trước ngày hiện tại.')
      return
    }

    navigate(`/tim-chuyen?${new URLSearchParams(form).toString()}`)
  }

  return (
    <form
      className={`trip-search-form${compact ? ' trip-search-form--compact' : ''}`}
      onSubmit={submit}
    >
      <div className="search-form-heading">
        <span className="eyebrow">
          {compact ? 'ĐẶT CHỖ TRỰC TUYẾN' : 'HỆ THỐNG MUA VÉ TRỰC TUYẾN TỰ ĐỘNG'}
        </span>
        <h2>Tìm chuyến xe phù hợp</h2>
      </div>

      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}

      <div className="row g-3 align-items-end">
        <div className="col-md-6 col-lg-3">
          <label className="form-label" htmlFor="departureProvinceId">
            Tỉnh/Thành đi
          </label>
          <select
            id="departureProvinceId"
            name="departureProvinceId"
            className="form-select"
            value={form.departureProvinceId}
            onChange={update}
            disabled={loading}
          >
            <option value="">
              {loading ? 'Đang tải danh mục...' : '-- Chọn tỉnh/thành đi --'}
            </option>
            {catalog.provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6 col-lg-3">
          <label className="form-label" htmlFor="arrivalProvinceId">
            Tỉnh/Thành đến
          </label>
          <select
            id="arrivalProvinceId"
            name="arrivalProvinceId"
            className="form-select"
            value={form.arrivalProvinceId}
            onChange={update}
            disabled={loading}
          >
            <option value="">
              {loading ? 'Đang tải danh mục...' : '-- Chọn tỉnh/thành đến --'}
            </option>
            {arrivalProvinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6 col-lg-3">
          <label className="form-label" htmlFor="departureDate">
            Ngày khởi hành
          </label>
          <input
            id="departureDate"
            name="departureDate"
            type="date"
            min={today}
            className="form-control"
            value={form.departureDate}
            onChange={update}
          />
        </div>

        <div className="col-md-6 col-lg-3 d-grid">
          <button
            type="submit"
            className="btn btn-warning btn-search"
            disabled={loading}
          >
            {compact ? 'Tìm chuyến' : 'Tìm kiếm chuyến xe'}
          </button>
        </div>
      </div>

      {validation && (
        <p className="form-error" role="alert">
          {validation}
        </p>
      )}
    </form>
  )
}

export default TripSearchForm
