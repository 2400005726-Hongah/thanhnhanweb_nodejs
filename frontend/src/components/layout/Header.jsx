import { NavLink } from 'react-router-dom'

import BrandLogo from '../common/BrandLogo.jsx'
import { useAuth } from '../../contexts/authContext.js'

const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

function Header() {
  const { isAuthenticated, signOut, user } = useAuth()

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
            <NavLink className={navClass} to="/tim-chuyen">Tìm chuyến</NavLink>
            <NavLink className={navClass} to="/tra-cuu-ve">Tra cứu vé</NavLink>
            <NavLink className={navClass} to="/dang-phat-trien/gioi-thieu">Giới thiệu</NavLink>
            <NavLink className={navClass} to="/dang-phat-trien/lien-he">Liên hệ</NavLink>
            {isAuthenticated ? (
              <>
                {user?.role === 'CUSTOMER' ? (
                  <NavLink className={navClass} to="/ve-cua-toi">Vé của tôi</NavLink>
                ) : (
                  <NavLink className={navClass} to="/admin">Khu quản lý</NavLink>
                )}
                <span className="header-user-name" title={user.fullName}>
                  {user.fullName}
                </span>
                <button className="btn btn-warning ms-lg-2 px-3" onClick={signOut} type="button">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <NavLink className={navClass} to="/dang-ky">Đăng ký</NavLink>
                <NavLink className="btn btn-warning ms-lg-2 px-3" to="/dang-nhap">Đăng nhập</NavLink>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
