import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicNewsDetail } from '../services/publicContent.service.js'
import { getApiErrorMessage } from '../services/apiClient.js'

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
      {!news && !error && <p className="mt-3">Đang tải...</p>}
      {news && (
        <article className="card border-0 shadow-sm p-4 p-lg-5 mt-3">
          <h1>{news.title}</h1>
          <p className="text-muted">{news.summary}</p>
          <div dangerouslySetInnerHTML={{ __html: news.content }} />
        </article>
      )}
    </main>
  )
}

export default NewsDetailPage
