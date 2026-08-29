import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import heroBusImage from '../assets/anhtrangchu.jpg'
import TripSearchForm from '../components/search/TripSearchForm.jsx'
import { LoadingState } from '../components/common/StatusState.jsx'
import './HomePage.css'

const bookingSteps = [
  ['01', 'Tìm chuyến', 'Chọn điểm đi, điểm đến và ngày khởi hành phù hợp.'],
  ['02', 'Chọn chỗ', 'Xem sơ đồ xe và chọn ghế/phòng còn trống.'],
  ['03', 'Điểm đón, trả', 'Chọn hình thức đón và trả theo cấu hình của chuyến.'],
  ['04', 'Thanh toán', 'Xác nhận thông tin, thanh toán và nhận thông tin vé.'],
]

const homeStats = [
  ['20+', 'XE KHÁCH ĐỜI MỚI', 'Đa dạng dòng xe giường nằm và limousine, hướng đến không gian sạch sẽ, tiện nghi và thoải mái.'],
  ['100k+', 'LƯỢT KHÁCH HÀI LÒNG', 'Hành khách được phục vụ qua hệ thống đặt vé trực tuyến, tổng đài hotline và các điểm giao dịch của nhà xe.'],
  ['24/7', 'TỔNG ĐÀI CHĂM SÓC', 'Tiếp nhận nhu cầu đặt vé, hỗ trợ tra cứu hành trình và giải đáp thông tin cần thiết cho hành khách.'],
]

const formatNewsDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

const extractNews = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.news)) return payload.news
  if (Array.isArray(payload?.data?.news)) return payload.data.news
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function HomePage() {
  const [latestNews, setLatestNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const loadNews = async () => {
      try {
        const response = await fetch('/api/v1/public/news?limit=3&page=1', {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Không tải được tin tức')
        const payload = await response.json()
        setLatestNews(extractNews(payload).slice(0, 3))
      } catch (error) {
        if (error?.name !== 'AbortError') setLatestNews([])
      } finally {
        setNewsLoading(false)
      }
    }

    loadNews()
    return () => controller.abort()
  }, [])

  return (
    <main className="tn-home">
      <section className="tn-hero">
        <img
          className="tn-hero__media"
          src={heroBusImage}
          alt=""
          width="2048"
          height="1536"
          fetchPriority="high"
          aria-hidden="true"
        />
        <div className="tn-hero__shade" />
        <div className="container tn-hero__content">
          <div className="tn-hero__copy">
            <span className="tn-kicker tn-kicker--light">NHÀ XE THÀNH NHÂN</span>
            <h1>
              Kết nối hành trình,
              <span>an tâm trên từng chuyến đi.</span>
            </h1>
            <p>
              Đặt vé trực tuyến cho các chuyến xe kết nối Đắk Lắk và
              Thành phố Hồ Chí Minh với thông tin lịch trình, chỗ ngồi
              và điểm đón trả rõ ràng.
            </p>
            <div className="tn-hero__actions">
              <a className="tn-btn tn-btn--primary" href="#tim-chuyen">Đặt vé ngay</a>
              <Link className="tn-btn tn-btn--ghost" to="/thong-tin/gioi-thieu">
                Giới thiệu nhà xe
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="tn-search" id="tim-chuyen">
        <div className="container">
          <div className="tn-search__card">
            <div className="tn-search__heading">
              <div>
                <span className="tn-kicker">ĐẶT VÉ TRỰC TUYẾN</span>
                <h2>Tìm chuyến phù hợp với bạn</h2>
              </div>
              <p>Chọn hành trình và ngày đi để xem các chuyến đang mở bán.</p>
            </div>
            <TripSearchForm />
          </div>
        </div>
      </section>

      <section className="tn-section tn-steps">
        <div className="container">
          <div className="tn-section__heading tn-section__heading--center">
            <span className="tn-kicker">QUY TRÌNH ĐẶT VÉ</span>
            <h2>Hoàn tất trong 4 bước</h2>
            <p>
              Các bước được tách rõ để khách hàng dễ kiểm tra thông tin
              trước khi xác nhận vé.
            </p>
          </div>

          <div className="tn-step-grid">
            {bookingSteps.map(([number, title, copy], index) => (
              <article className="tn-step-card" key={number}>
                <div className="tn-step-card__top">
                  <span className="tn-step-card__number">{number}</span>
                  {index < bookingSteps.length - 1 && (
                    <span className="tn-step-card__line" aria-hidden="true" />
                  )}
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tn-section tn-about">
        <div className="container">
          <div className="tn-about__grid">
            <div className="tn-about__image-wrap">
              <img
                src={heroBusImage}
                alt="Xe khách Thành Nhân"
                className="tn-about__image"
                loading="lazy"
              />
              <div className="tn-about__badge">
                <strong>Thành Nhân</strong>
                <span>Đồng hành trên mỗi hành trình</span>
              </div>
            </div>

            <div className="tn-about__content">
              <span className="tn-kicker">VỀ CHÚNG TÔI</span>
              <h2 className="tn-section-title">
                Tập trung vào an toàn, lịch trình và trải nghiệm đặt vé
              </h2>
              <p>
                Website được xây dựng để khách hàng chủ động tìm chuyến,
                chọn chỗ, chọn điểm đón trả và tra cứu thông tin vé.
                Dữ liệu mỗi chuyến được quản lý tập trung để hỗ trợ nhà xe
                trong quá trình vận hành.
              </p>

              <div className="tn-about__highlights">
                <div>
                  <strong>34 giường</strong>
                  <span>Sơ đồ chỗ rõ ràng</span>
                </div>
                <div>
                  <strong>22 phòng</strong>
                  <span>Phòng đơn và phòng đôi</span>
                </div>
                <div>
                  <strong>24/7</strong>
                  <span>Tra cứu vé trực tuyến</span>
                </div>
              </div>

              <Link className="tn-text-link" to="/thong-tin/gioi-thieu">
                Xem thêm về Nhà xe Thành Nhân →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="tn-mvc-stats" aria-label="Thông tin nổi bật">
        <div className="container">
          <div className="tn-mvc-stats__grid">
            {homeStats.map(([value, title, copy]) => (
              <article className="tn-mvc-stat" key={value}>
                <strong>{value}</strong>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tn-news-home">
        <div className="container">
          <div className="tn-news-home__head">
            <div>
              <span className="tn-kicker">THÔNG TIN MỚI NHẤT</span>
              <h2>Tin tức nhà xe</h2>
            </div>
            <Link className="tn-news-home__all" to="/tin-tuc">
              Xem tất cả →
            </Link>
          </div>

          {newsLoading ? (
            <LoadingState label="Đang tải tin tức..." />
          ) : latestNews.length > 0 ? (
            <div className="tn-news-home__grid">
              {latestNews.map((item) => (
                <article className="tn-news-card" key={item.id}>
                  <Link className="tn-news-card__image-link" to={`/tin-tuc/${item.id}`}>
                    <img
                      className="tn-news-card__image"
                      src={item.thumbnailUrl || heroBusImage}
                      alt={item.title}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = heroBusImage
                      }}
                    />
                  </Link>

                  <div className="tn-news-card__body">
                    <div className="tn-news-card__meta">
                      {formatNewsDate(item.publishedAt || item.createdAt)}
                    </div>

                    <h3>
                      <Link to={`/tin-tuc/${item.id}`}>{item.title}</Link>
                    </h3>

                    <p>{item.summary}</p>

                    <Link className="tn-news-card__button" to={`/tin-tuc/${item.id}`}>
                      Xem chi tiết
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="tn-news-home__empty">
              Hiện chưa có tin tức đang hiển thị.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default HomePage
