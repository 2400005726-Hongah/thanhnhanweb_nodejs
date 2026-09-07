import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import logoFallback from '../assets/logo-thanh-nhan-moi.png'
import { LoadingState } from '../components/common/StatusState.jsx'
import { getPublicNewsDetail } from '../services/publicContent.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'
import { formatDateTime } from '../utils/formatDateTime.js'
import './NewsDetailPage.css'

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
    <main className="container py-5 news-detail-page">
      <Link to="/tin-tuc">← Quay lại tin tức</Link>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {!news && !error && <LoadingState label="Đang tải bài viết..." />}

      {news && (
        <article className="news-detail-card mt-3 mx-auto">
          <h1>{news.title}</h1>
          <div className="news-detail-meta">
            {formatDateTime(news.publishedAt || news.createdAt)} · {news.createdBy?.fullName || 'Nhà xe Thành Nhân'} · {news.viewCount ?? 0} lượt xem
          </div>

          <img
            alt={news.title}
            className="news-detail-cover"
            src={news.thumbnailUrl || logoFallback}
          />

          {news.summary && <p className="news-detail-summary">{news.summary}</p>}

          <div
            className="news-detail-content"
            dangerouslySetInnerHTML={{ __html: news.content }}
          />

          <div className="text-center mt-5">
            <Link className="btn btn-outline-primary px-4" to="/tin-tuc">
              Quay lại danh sách tin
            </Link>
          </div>
        </article>
      )}
    </main>
  )
}

export default NewsDetailPage
