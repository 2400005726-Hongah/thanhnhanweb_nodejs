import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicNews } from '../services/publicContent.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'

function NewsListPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPublicNews({ page: 1, limit: 30 })
      .then(setData)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
  }, [])

  return (
    <main className="container py-5">
      <h1 className="mb-4">Tin tức</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      {!data && !error && <p>Đang tải tin tức...</p>}
      <div className="row g-4">
        {(data?.news || []).map((item) => (
          <div className="col-md-6 col-lg-4" key={item.id}>
            <article className="card h-100 border-0 shadow-sm">
              {item.thumbnailUrl && <img className="card-img-top" src={item.thumbnailUrl} alt="" />}
              <div className="card-body">
                <h2 className="h5">{item.title}</h2>
                <p>{item.summary}</p>
                <Link to={`/tin-tuc/${item.id}`}>Xem chi tiết</Link>
              </div>
            </article>
          </div>
        ))}
      </div>
      {data?.news?.length === 0 && <p>Chưa có tin tức được xuất bản.</p>}
    </main>
  )
}

export default NewsListPage
