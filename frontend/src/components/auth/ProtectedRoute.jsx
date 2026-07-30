import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../contexts/authContext.js'
import { hasPermission } from '../../utils/adminPermissions.js'

function ProtectedRoute({ allowedRoles = [], requiredPermissions = [] }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}`
    return (
      <Navigate
        replace
        to={`/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`}
      />
    )
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate replace to="/" />
  }

  if (
    requiredPermissions.length > 0 &&
    requiredPermissions.some((permission) => !hasPermission(user, permission))
  ) {
    return <Navigate replace to="/admin" />
  }

  return <Outlet />
}

export default ProtectedRoute
