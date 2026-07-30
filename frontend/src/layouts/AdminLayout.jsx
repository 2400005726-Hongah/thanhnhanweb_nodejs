import { NavLink, Outlet } from 'react-router-dom'

import BrandLogo from '../components/common/BrandLogo.jsx'
import { useAuth } from '../contexts/authContext.js'
import {
  hasPermission,
  PERMISSIONS,
  ROLE_LABELS,
} from '../utils/adminPermissions.js'

const menuItems = [
  {
    label: 'Tổng quan',
    staffLabel: 'Tổng quan vận hành',
    to: '/admin',
    end: true,
    permission: PERMISSIONS.VIEW_OPERATION_DASHBOARD,
  },
  { label: 'Xe', to: '/admin/xe', permission: PERMISSIONS.VIEW_BUSES },
  {
    label: 'Chuyến xe & Tuyến đường',
    to: '/admin/chuyen-xe-tuyen-duong',
    permission: PERMISSIONS.VIEW_TRIPS,
  },
  {
    label: 'Vé xe',
    to: '/admin/ve-xe',
    permission: PERMISSIONS.VIEW_BOOKINGS,
  },
  { label: 'Kiểm tra vé', to: '/tra-cuu-ve', permission: PERMISSIONS.VIEW_BOOKINGS },
  {
    label: 'Khách hàng',
    to: '/admin/khach-hang',
    permission: PERMISSIONS.VIEW_CUSTOMERS,
  },
  {
    label: 'Thống kê',
    to: '/admin/thong-ke',
    permission: PERMISSIONS.VIEW_REVENUE,
  },
  {
    label: 'Tài khoản',
    to: '/admin/tai-khoan',
    permission: PERMISSIONS.MANAGE_USERS,
  },
  {
    label: 'Nhật ký hệ thống',
    to: '/admin/nhat-ky',
    permission: PERMISSIONS.VIEW_SYSTEM_LOGS,
  },
  {
    label: 'Quản lý tin tức',
    to: '/admin/tin-tuc',
    permission: PERMISSIONS.MANAGE_NEWS,
  },
]

const navClass = ({ isActive }) =>
  `admin-nav-link${isActive ? ' active' : ''}`

function AdminLayout() {
  const { signOut, user } = useAuth()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <NavLink className="admin-brand" to="/admin">
          <BrandLogo alt="Nhà xe Thành Nhân" />
        </NavLink>
        <div className="admin-role-card">
          <strong>{user?.fullName}</strong>
          <span>
            {ROLE_LABELS[user?.role] || user?.role}
            {user?.role === 'ADMIN' ? ' – Toàn quyền' : ''}
          </span>
        </div>
        <nav aria-label="Điều hướng quản lý">
          {menuItems
            .filter((item) => hasPermission(user, item.permission))
            .map((item) => (
              <NavLink
                className={navClass}
                end={item.end}
                key={item.to}
                to={item.to}
              >
                {user?.role === 'STAFF' && item.staffLabel
                  ? item.staffLabel
                  : item.label}
              </NavLink>
            ))}
        </nav>
        <button className="admin-signout" onClick={signOut} type="button">
          Đăng xuất
        </button>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span>KHU VỰC QUẢN LÝ</span>
            <strong>{ROLE_LABELS[user?.role] || user?.role}</strong>
          </div>
          <NavLink to="/">Xem website khách hàng</NavLink>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </section>
    </div>
  )
}

export default AdminLayout
