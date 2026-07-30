import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  login as loginRequest,
  register as registerRequest,
} from '../services/auth.service.js'
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
} from '../utils/authStorage.js'
import { AuthContext } from './authContext.js'

function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getAuthSession())
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null)

      if (location.pathname !== '/dang-nhap') {
        const returnUrl = `${location.pathname}${location.search}`
        navigate(`/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`, {
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

  const signIn = useCallback(
    async (credentials) =>
      persistSession(await loginRequest(credentials)),
    [persistSession],
  )

  const signUp = useCallback(
    async (payload) =>
      persistSession(await registerRequest(payload)),
    [persistSession],
  )

  const signOut = useCallback(() => {
    clearAuthSession()
    setSession(null)
    navigate('/', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      token: session?.token || null,
      user: session?.user || null,
      signIn,
      signOut,
      signUp,
    }),
    [session, signIn, signOut, signUp],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }
