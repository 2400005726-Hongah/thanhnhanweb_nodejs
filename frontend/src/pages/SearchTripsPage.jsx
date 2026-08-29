import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import TripCard from '../components/search/TripCard.jsx'
import heroBusImage from '../assets/anhtrangchu.jpg'
import TripSearchForm from '../components/search/TripSearchForm.jsx'
import { getApiErrorMessage } from '../services/apiClient.js'
import { getTripSearchCatalog, searchTrips } from '../services/publicTrip.service.js'

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
                  <div className="trip-list">
                    {result.trips.map((trip) => (
                      <TripCard key={trip.id} trip={trip} />
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
