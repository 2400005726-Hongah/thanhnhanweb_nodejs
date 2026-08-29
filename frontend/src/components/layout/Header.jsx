import { NavLink } from 'react-router-dom'

import BrandLogo from '../common/BrandLogo.jsx'

const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

function Header() {
  return (
    <header className="site-header sticky-top">
      <nav className="navbar navbar-expand-lg navbar-light container py-1">
        <NavLink className="navbar-brand brand" to="/" aria-label="Nhà xe Thành Nhân - Trang chủ">
          <BrandLogo alt="" />
        </NavLink>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#customerNav" aria-controls="customerNav" aria-expanded="false" aria-label="Mở menu">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="customerNav">
          <div className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
            <NavLink className={navClass} to="/" end>Trang chủ</NavLink>
            <NavLink className={navClass} to="/thong-tin/gioi-thieu">Giới thiệu</NavLink>
            <NavLink className={navClass} to="/tim-chuyen">Đặt vé Online</NavLink>
            <NavLink className={navClass} to="/tra-cuu-ve">Tra cứu vé</NavLink>
            <NavLink className={navClass} to="/tin-tuc">Tin tức</NavLink>
            <NavLink className={navClass} to="/thong-tin/lien-he">Liên hệ</NavLink>
            <a className="btn btn-warning btn-sm ms-lg-2 customer-hotline" href="tel:0979406406" aria-label="Gọi Hotline 0979 406 406">
              Hotline 0979 406 406
            </a>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
