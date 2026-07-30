import { Link } from 'react-router-dom'

import BrandLogo from '../common/BrandLogo.jsx'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="brand brand--footer"><BrandLogo variant="footer" /></div>
            <p className="mt-3 footer-intro">Kết nối Đắk Lắk và Thành phố Hồ Chí Minh bằng những chuyến xe an toàn, đúng giờ và tận tâm.</p>
          </div>
          <div className="col-6 col-lg-3">
            <h2 className="footer-heading">Liên kết</h2>
            <Link to="/tim-chuyen">Tìm chuyến</Link>
            <Link to="/tra-cuu-ve">Tra cứu vé</Link>
            <Link to="/dang-phat-trien/gioi-thieu">Về chúng tôi</Link>
          </div>
          <div className="col-6 col-lg-4">
            <h2 className="footer-heading">Hỗ trợ khách hàng</h2>
            <p>Hotline: 0947 406 406</p>
            <p>Email: hotro@thanhnhan.vn</p>
            <p>Phục vụ mỗi ngày: 06:00 – 22:00</p>
          </div>
        </div>
      </div>
      <div className="footer-bottom"><div className="container">© 2026 Nhà xe Thành Nhân. Đồ án hệ thống đặt vé trực tuyến.</div></div>
    </footer>
  )
}

export default Footer
