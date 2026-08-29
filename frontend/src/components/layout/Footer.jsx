import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-4">
            <h2 className="footer-heading">Nhà xe Thành Nhân</h2>
            <p className="footer-intro">
              Kết nối Đắk Lắk và Thành phố Hồ Chí Minh bằng những chuyến xe
              an toàn, đúng giờ và tận tâm.
            </p>
            <p><strong>Văn phòng chính:</strong> Buôn Hồ, Đắk Lắk</p>
            <a href="tel:0979406406">Hotline: 0979 406 406</a>
            <a href="mailto:hotro@thanhnhanweb.vn">
              Email: hotro@thanhnhanweb.vn
            </a>
          </div>

          <div className="col-6 col-lg-2">
            <h2 className="footer-heading">Tuyến đường</h2>
            <Link to="/tim-chuyen">Đặt vé Online</Link>
            <Link to="/tra-cuu-ve">Tra cứu vé</Link>
          </div>

          <div className="col-6 col-lg-3">
            <h2 className="footer-heading">Chính sách hỗ trợ</h2>
            <Link to="/thong-tin/quy-che-hoat-dong">Quy chế hoạt động</Link>
            <Link to="/thong-tin/chinh-sach-huy-ve">Quy định đổi / hủy vé</Link>
            <Link to="/thong-tin/bao-mat">Chính sách bảo mật</Link>
            <Link to="/thong-tin/dieu-khoan">Điều khoản sử dụng</Link>
            <Link to="/thong-tin/huong-dan-dat-ve">
              Hướng dẫn đặt vé / thanh toán
            </Link>
          </div>

          <div className="col-6 col-lg-3">
            <h2 className="footer-heading">Thông tin</h2>
            <Link to="/thong-tin/gioi-thieu">Giới thiệu</Link>
            <Link to="/tin-tuc">Tin tức</Link>
            <Link to="/thong-tin/lien-he">Liên hệ</Link>
            <Link to="/tra-cuu-ve">Tra cứu vé</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          © 2026 Nhà xe Thành Nhân. Hệ thống quản lý và đặt vé xe trực tuyến.
        </div>
      </div>
    </footer>
  )
}

export default Footer
