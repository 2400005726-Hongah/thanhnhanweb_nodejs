import { Link } from 'react-router-dom'

import heroBusImage from '../assets/anhtrangchu.jpg'
import TripSearchForm from '../components/search/TripSearchForm.jsx'

const benefits = [
  ['01', 'Đặt vé nhanh chóng', 'Tìm chuyến và chọn ghế trực quan chỉ trong vài bước.'],
  ['02', 'Xe chất lượng', 'Dòng xe giường nằm và limousine sạch sẽ, tiện nghi.'],
  ['03', 'Nhiều khung giờ', 'Linh hoạt lựa chọn lịch trình phù hợp với kế hoạch của bạn.'],
  ['04', 'Hỗ trợ tận tâm', 'Đội ngũ nhà xe đồng hành trước, trong và sau chuyến đi.'],
]

function HomePage() {
  return (
    <>
      <section className="hero-section">
        <img
          className="hero-media"
          src={heroBusImage}
          alt=""
          width="2048"
          height="1536"
          fetchPriority="high"
          aria-hidden="true"
        />
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="hero-kicker">HỆ THỐNG ĐẶT VÉ TRỰC TUYẾN</span>
            <h1>Đi xa hơn,<br /><em>an tâm hơn.</em></h1>
            <p>Đồng hành cùng hành khách trên những cung đường kết nối Đắk Lắk và Thành phố Hồ Chí Minh — an toàn, đúng giờ và tận tâm trên từng chuyến đi.</p>
            <div className="hero-actions"><a className="btn btn-warning btn-lg" href="#tim-chuyen">Đặt vé ngay</a><Link className="hero-about-link" to="/dang-phat-trien/gioi-thieu">Khám phá nhà xe →</Link></div>
          </div>
        </div>
      </section>

      <section className="search-overlap home-search" id="tim-chuyen"><div className="container"><TripSearchForm /></div></section>

      <section className="service-section section-space">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-5"><span className="eyebrow">THÀNH NHÂN ĐỒNG HÀNH</span><h2 className="section-title">Mỗi hành trình là một lời cam kết</h2><p className="section-copy">Chúng tôi chăm chút từ lịch trình, phương tiện đến cách phục vụ để mỗi chuyến xe là một trải nghiệm dễ chịu.</p><Link className="text-link" to="/dang-phat-trien/gioi-thieu">Tìm hiểu về Thành Nhân →</Link></div>
            <div className="col-lg-7"><div className="service-stats"><div><strong>44</strong><span>Giường rộng rãi</span></div><div><strong>22</strong><span>Phòng limousine</span></div><div><strong>10</strong><span>Tuyến hoạt động</span></div></div></div>
          </div>
        </div>
      </section>

      <section className="benefits-section section-space">
        <div className="container"><div className="section-heading"><span className="eyebrow">VÌ SAO CHỌN CHÚNG TÔI</span><h2 className="section-title">Trọn vẹn trên từng chặng đường</h2></div><div className="row g-4">{benefits.map(([number, title, copy]) => <div className="col-md-6 col-xl-3" key={number}><article className="benefit-card"><span>{number}</span><h3>{title}</h3><p>{copy}</p></article></div>)}</div></div>
      </section>
    </>
  )
}

export default HomePage
