import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { adminLogin as adminLoginRequest } from '../services/auth.service.js'
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
} from '../utils/authStorage.js'
import { AuthContext } from './authContext.js'

const getInitialAdminSession = () => {
  const current = getAuthSession()
  if (current?.user && ['ADMIN', 'STAFF'].includes(current.user.role)) {
    return current
  }
  if (current) clearAuthSession()
  return null
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(getInitialAdminSession)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null)
      const isAdminLogin = location.pathname === '/admin/dang-nhap'
      if (!isAdminLogin) {
        const returnUrl = `${location.pathname}${location.search}`
        navigate(`/admin/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`, {
          replace: true,
        })
      }
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [location.pathname, location.search, navigate])

  const persistSession = useCallback((data) => {
    const nextSession = saveAuthSession(data)
    setSession(nextSession)
    return nextSession
  }, [])

  const signInAdmin = useCallback(
    async (credentials) =>
      persistSession(await adminLoginRequest(credentials)),
    [persistSession],
  )

  const signOut = useCallback(() => {
    clearAuthSession()
    setSession(null)
    navigate('/admin/dang-nhap', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      token: session?.token || null,
      user: session?.user || null,
      signInAdmin,
      signOut,
    }),
    [session, signInAdmin, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }
