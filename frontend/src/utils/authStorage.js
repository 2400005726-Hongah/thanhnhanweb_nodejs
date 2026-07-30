const AUTH_SESSION_KEY = 'thanh-nhan-auth-session'
const AUTH_UNAUTHORIZED_EVENT = 'thanh-nhan-auth-unauthorized'

const getAuthSession = () => {
  try {
    const rawSession = window.sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!rawSession) return null

    const session = JSON.parse(rawSession)
    if (!session?.token || !session?.user?.id) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY)
      return null
    }

    return session
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY)
    return null
  }
}

const saveAuthSession = ({ token, user }) => {
  const session = { token, user }
  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  return session
}

const clearAuthSession = () => {
  window.sessionStorage.removeItem(AUTH_SESSION_KEY)
}

export {
  AUTH_SESSION_KEY,
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
}
