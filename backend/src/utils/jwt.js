import jwt from 'jsonwebtoken'

import env from '../config/env.js'

const ensureJwtSecret = () => {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET chưa được cấu hình')
  }

  if (env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET phải có ít nhất 32 ký tự')
  }
}

const generateToken = (user) => {
  ensureJwtSecret()

  return jwt.sign(
    {
      userId: String(user.id || user._id),
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  )
}

const verifyToken = (token) => {
  ensureJwtSecret()
  return jwt.verify(token, env.jwtSecret)
}

export { generateToken, verifyToken }
