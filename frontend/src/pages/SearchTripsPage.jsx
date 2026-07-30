import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, LoadingState } from '../components/common/StatusState.jsx'
import TripCard from '../components/search/TripCard.jsx'
import TripSearchForm from '../components/search/TripSearchForm.jsx'
import { getApiErrorMessage } from '../services/apiClient.js'
import { searchTrips } from '../services/publicTrip.service.js'

function SearchTripsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryString = searchParams.toString()
  const query = useMemo(
    () => Object.fromEntries(new URLSearchParams(queryString).entries()),
    [queryString],
  )
  const requiredReady = query.departureLocationId && query.arrivalLocationId && query.departureDate
  const [result, setResult] = useState({ trips: [], pagination: null })
  const [loading, setLoading] = useState(Boolean(requiredReady))
  const [error, setError] = useState('')

  const loadTrips = useCallback(() => {
    if (!requiredReady) return
    setLoading(true)
    setError('')
    searchTrips(Object.fromEntries(new URLSearchParams(queryString).entries()))
      .then(setResult)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false))
  }, [queryString, requiredReady])

  useEffect(() => { loadTrips() }, [loadTrips])

  const updateFilter = (event) => {
    const next = new URLSearchParams(searchParams)
    if (event.target.value) next.set(event.target.name, event.target.value)
    else next.delete(event.target.name)
    next.set('page', '1')
    setSearchParams(next)
  }

  const setPage = (page) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  return (
    <div className="page-surface">
      <section className="page-banner"><div className="container"><span className="eyebrow eyebrow--light">LỊCH TRÌNH THÀNH NHÂN</span><h1>Tìm chuyến xe</h1><p>So sánh lịch trình, loại xe và giá vé theo nhu cầu của bạn.</p></div></section>
      <div className="container page-content">
        <TripSearchForm compact initialValues={{ departureLocationId: query.departureLocationId || '', arrivalLocationId: query.arrivalLocationId || '', departureDate: query.departureDate || '' }} />
        {requiredReady && <div className="filter-bar"><strong>Bộ lọc</strong><select className="form-select" name="busType" value={query.busType || ''} onChange={updateFilter} aria-label="Lọc loại xe"><option value="">Tất cả loại xe</option><option value="SLEEPER">Giường nằm</option><option value="LIMOUSINE">Limousine</option><option value="SEATED">Ghế ngồi</option></select><select className="form-select" name="departureTimeFrom" value={query.departureTimeFrom || ''} onChange={updateFilter} aria-label="Lọc giờ đi"><option value="">Mọi khung giờ</option><option value="06:00">Từ 06:00</option><option value="12:00">Từ 12:00</option><option value="18:00">Từ 18:00</option></select><select className="form-select" name="sort" value={query.sort || 'departureTimeAsc'} onChange={updateFilter} aria-label="Sắp xếp"><option value="departureTimeAsc">Giờ đi sớm nhất</option><option value="departureTimeDesc">Giờ đi muộn nhất</option><option value="priceAsc">Giá thấp đến cao</option><option value="priceDesc">Giá cao đến thấp</option></select></div>}
        {!requiredReady ? <EmptyState title="Chọn hành trình của bạn" message="Hãy chọn điểm đi, điểm đến và ngày đi để xem các chuyến phù hợp." /> : loading ? <LoadingState label="Đang tìm những chuyến xe phù hợp..." /> : error ? <ErrorState message={error} onRetry={loadTrips} /> : result.trips.length === 0 ? <EmptyState title="Chưa có chuyến phù hợp" message="Bạn hãy thử chọn ngày khác hoặc thay đổi bộ lọc tìm kiếm." /> : <section className="results-section"><div className="results-heading"><div><span className="eyebrow">KẾT QUẢ TÌM KIẾM</span><h2>{result.pagination.total} chuyến phù hợp</h2></div><span>Giờ hiển thị theo múi giờ Việt Nam</span></div><div className="trip-list">{result.trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}</div>{result.pagination.totalPages > 1 && <nav className="pagination-wrap" aria-label="Phân trang chuyến xe"><button className="btn btn-outline-primary" disabled={result.pagination.page <= 1} onClick={() => setPage(result.pagination.page - 1)}>Trang trước</button><span>Trang {result.pagination.page}/{result.pagination.totalPages}</span><button className="btn btn-outline-primary" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage(result.pagination.page + 1)}>Trang sau</button></nav>}</section>}
      </div>
    </div>
  )
}

export default SearchTripsPage
