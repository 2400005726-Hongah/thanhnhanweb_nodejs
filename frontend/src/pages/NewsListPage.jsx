import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import logoFallback from '../assets/logo-thanh-nhan-moi.png'
import { LoadingState } from '../components/common/StatusState.jsx'
import { getPublicNews } from '../services/publicContent.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { formatDateTime } from '../utils/formatDateTime.js'

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
      <div className="text-center mb-5">
        <h1 className="fw-bold">Tin tức</h1>
        <p className="text-muted mb-0">Thông báo và hoạt động mới nhất từ Nhà xe Thành Nhân</p>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {!data && !error && <LoadingState label="Đang tải tin tức..." />}
      <div className="row g-4">
        {(data?.news || []).map((item) => (
          <div className="col-md-6 col-lg-4" key={item.id}>
            <article className="card h-100 border-0 shadow-sm overflow-hidden">
              <img
                alt={item.title}
                className="card-img-top"
                src={item.thumbnailUrl || logoFallback}
                style={{ height: 220, objectFit: 'cover' }}
              />
              <div className="card-body d-flex flex-column p-4">
                <div className="small text-muted mb-2">
                  {formatDateTime(item.publishedAt || item.createdAt)} · {item.viewCount ?? 0} lượt xem
                </div>
                <h2 className="h5 fw-bold">{item.title}</h2>
                <p className="text-muted">{item.summary || 'Xem nội dung chi tiết của bài viết.'}</p>
                <Link className="btn btn-primary mt-auto" to={`/tin-tuc/${item.id}`}>Xem chi tiết</Link>
              </div>
            </article>
          </div>
        ))}
      </div>
      {data?.news?.length === 0 && <div className="alert alert-light border text-center">Chưa có bài viết nào được đăng.</div>}
    </main>
  )
}

export default NewsListPage
