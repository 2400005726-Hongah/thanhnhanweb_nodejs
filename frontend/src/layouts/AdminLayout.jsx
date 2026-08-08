import {
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useMemo, useState } from 'react'

import {
  useAuth,
} from '../contexts/authContext.js'
import {
  hasPermission,
  PERMISSIONS,
  ROLE_LABELS,
} from '../utils/adminPermissions.js'

const menuItems = [
  {
    icon: 'dashboard',
    label: 'Tổng quan',
    staffLabel: 'Tổng quan vận hành',
    to: '/admin',
    end: true,
    permission:
      PERMISSIONS.VIEW_OPERATION_DASHBOARD,
  },
  {
    icon: 'bus',
    label: 'Xe',
    to: '/admin/xe',
    permission:
      PERMISSIONS.VIEW_BUSES,
  },
  {
    icon: 'route',
    label: 'Địa điểm',
    to: '/admin/dia-diem',
    permission:
      PERMISSIONS.MANAGE_USERS,
  },
  {
    icon: 'route',
    label: 'Chuyến xe & Tuyến đường',
    to:
      '/admin/chuyen-xe-tuyen-duong',
    permission:
      PERMISSIONS.VIEW_TRIPS,
  },
  {
    icon: 'ticket',
    label: 'Vé xe',
    to: '/admin/ve-xe',
    permission:
      PERMISSIONS.VIEW_BOOKINGS,
  },
  {
    icon: 'search',
    label: 'Kiểm tra vé',
    to: '/admin/kiem-tra-ve',
    permission:
      PERMISSIONS.VIEW_BOOKINGS,
  },
  {
    icon: 'customers',
    label: 'Khách hàng',
    to: '/admin/khach-hang',
    permission:
      PERMISSIONS.VIEW_CUSTOMERS,
  },
  {
    icon: 'chart',
    label: 'Thống kê',
    to: '/admin/thong-ke',
    permission:
      PERMISSIONS.VIEW_REVENUE,
  },
  {
    icon: 'users',
    label: 'Tài khoản',
    to: '/admin/tai-khoan',
    permission:
      PERMISSIONS.MANAGE_USERS,
  },
  {
    icon: 'history',
    label: 'Nhật ký hệ thống',
    to: '/admin/nhat-ky',
    permission:
      PERMISSIONS.VIEW_SYSTEM_LOGS,
  },
  {
    icon: 'news',
    label: 'Quản lý tin tức',
    to: '/admin/tin-tuc',
    permission:
      PERMISSIONS.MANAGE_NEWS,
  },
]

const iconPaths = {
  dashboard: (
    <>
      <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
    </>
  ),
  bus: (
    <>
      <path d="M6 3h12a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2v2a1 1 0 0 1-2 0v-2H7v2a1 1 0 0 1-2 0v-2a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3Zm0 3v5h12V6H6Zm1 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </>
  ),
  route: (
    <>
      <path d="M7 3a3 3 0 1 1-2 5.24V17a2 2 0 0 0 2 2h3v2H7a4 4 0 0 1-4-4V8.24A3 3 0 0 1 7 3Zm10 0a3 3 0 1 1-2 5.24V11a4 4 0 0 1-4 4H9v-2h2a2 2 0 0 0 2-2V8.24A3 3 0 0 1 17 3Z" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm5 3v2h8V8H8Zm0 4v2h6v-2H8Z" />
    </>
  ),
  search: (
    <>
      <path d="M10.5 4a6.5 6.5 0 1 1-4.12 11.53L2.9 19l-1.4-1.4 3.47-3.48A6.5 6.5 0 0 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
    </>
  ),
  customers: (
    <>
      <path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-2a6 6 0 0 1 12 0v2H2Zm13.5 0v-2a7.5 7.5 0 0 0-1.25-4.15A5 5 0 0 1 22 18v2h-6.5Z" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16v2H2V4h2v16Zm3-2H5v-6h2v6Zm5 0H9V8h3v10Zm5 0h-3V5h3v13Zm4 0h-2v-8h2v8Z" />
    </>
  ),
  users: (
    <>
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-8 9a8 8 0 0 1 16 0H4Zm16.5-8 1.5 1.5L19.5 17 18 15.5l2.5-2.5Z" />
    </>
  ),
  history: (
    <>
      <path d="M12 3a9 9 0 1 1-8.49 6H1l3.5-4L8 9H5.58A7 7 0 1 0 12 5V3Zm-1 4h2v5.17l3.24 1.87-1 1.73L11 13.32V7Z" />
    </>
  ),
  news: (
    <>
      <path d="M4 3h14a2 2 0 0 1 2 2v14H6a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2Zm2 4v2h10V7H6Zm0 4v2h10v-2H6Zm0 4v2h7v-2H6Z" />
    </>
  ),
}

function AdminIcon({ name }) {
  return (
    <svg
      aria-hidden="true"
      className="admin-nav-icon"
      viewBox="0 0 24 24"
    >
      {iconPaths[name] || iconPaths.dashboard}
    </svg>
  )
}

const navClass = ({ isActive }) =>
  `admin-nav-link${isActive ? ' active' : ''}`

function AdminLayout() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleItems = menuItems
    .filter((item) => hasPermission(user, item.permission))

  const activeTitle = useMemo(() => {
    const match = [...visibleItems]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) =>
        item.end
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to),
      )

    if (location.pathname.includes('/hanh-khach')) {
      return 'Danh sách hành khách'
    }

    if (location.pathname.includes('/dat-ve-')) {
      return 'Tạo vé xe'
    }

    if (location.pathname.match(/\/admin\/ve-xe\/.+/)) {
      return 'Chi tiết vé xe'
    }

    if (location.pathname.match(/\/admin\/khach-hang\/.+/)) {
      return 'Chi tiết khách hàng'
    }

    return match?.label || 'Khu vực quản lý'
  }, [location.pathname, visibleItems])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`admin-shell${menuOpen ? ' menu-open' : ''}`}>
      <button
        aria-label="Đóng menu quản trị"
        className="admin-sidebar-backdrop"
        onClick={closeMenu}
        type="button"
      />

      <aside className="admin-sidebar">
        <NavLink
          className="admin-brand"
          onClick={closeMenu}
          to="/admin"
        >
          <span className="admin-brand-mark">
            <AdminIcon name="bus" />
          </span>

          <span>
            <strong>Thành Nhân</strong>
            <small>Admin</small>
          </span>
        </NavLink>

        <nav aria-label="Điều hướng quản lý">
          {menuItems
            .filter((item) => hasPermission(user, item.permission))
            .map((item) => (
              <NavLink
                className={navClass}
                end={item.end}
                key={item.to}
                onClick={closeMenu}
                to={item.to}
              >
                <AdminIcon name={item.icon} />
                <span>
                  {user?.role === 'STAFF' && item.staffLabel
                    ? item.staffLabel
                    : item.label}
                </span>
              </NavLink>
            ))}
        </nav>

        <button
          className="admin-signout"
          onClick={signOut}
          type="button"
        >
          <span aria-hidden="true">↪</span>
          Đăng xuất
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <button
              aria-label="Mở menu quản trị"
              className="admin-menu-toggle"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              ☰
            </button>

            <h1>{activeTitle}</h1>
          </div>

          <div className="admin-topbar-user">
            <span className="admin-role-badge">
              {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}
            </span>

            <span className="admin-user-icon" aria-hidden="true">●</span>

            <strong>
              {user?.fullName ||
                ROLE_LABELS[user?.role] ||
                'Người dùng'}
            </strong>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </section>
    </div>
  )
}

export default AdminLayout
