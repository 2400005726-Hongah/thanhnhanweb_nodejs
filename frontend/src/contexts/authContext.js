import { createContext, useContext } from 'react'

const AuthContext = createContext(null)

const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider')
  }

  return context
}

export { AuthContext, useAuth }
