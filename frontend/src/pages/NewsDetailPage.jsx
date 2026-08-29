import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import logoFallback from '../assets/logo-thanh-nhan-moi.png'
import { LoadingState } from '../components/common/StatusState.jsx'
import { getPublicNewsDetail } from '../services/publicContent.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { formatDateTime } from '../utils/formatDateTime.js'

function NewsDetailPage() {
  const { id } = useParams()
  const [news, setNews] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPublicNewsDetail(id)
      .then((result) => setNews(result.news || result))
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
  }, [id])

  return (
    <main className="container py-5">
      <Link to="/tin-tuc">← Quay lại tin tức</Link>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {!news && !error && <LoadingState label="Đang tải bài viết..." />}
      {news && (
        <article className="card border-0 shadow-sm p-4 p-lg-5 mt-3 mx-auto" style={{ maxWidth: 980 }}>
          <h1 className="fw-bold text-center mb-3">{news.title}</h1>
          <div className="text-center text-muted mb-4">
            {formatDateTime(news.publishedAt || news.createdAt)} · {news.createdBy?.fullName || 'Nhà xe Thành Nhân'} · {news.viewCount ?? 0} lượt xem
          </div>
          <img
            alt={news.title}
            className="img-fluid rounded mb-4 w-100"
            src={news.thumbnailUrl || logoFallback}
            style={{ maxHeight: 460, objectFit: 'cover' }}
          />
          {news.summary && <p className="lead fw-semibold">{news.summary}</p>}
          <div dangerouslySetInnerHTML={{ __html: news.content }} />
          <div className="text-center mt-5">
            <Link className="btn btn-outline-primary px-4" to="/tin-tuc">Quay lại danh sách tin</Link>
          </div>
        </article>
      )}
    </main>
  )
}

export default NewsDetailPage
