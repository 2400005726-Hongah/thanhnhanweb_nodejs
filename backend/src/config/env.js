import dotenv from 'dotenv'

const envFilePath = new URL('../../.env', import.meta.url)

dotenv.config({ path: envFilePath, quiet: true })

const parsePort = (value) => {
  const port = Number(value ?? 5000)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 1 đến 65535')
  }

  return port
}

const parseBcryptSaltRounds = (value) => {
  const rounds = Number(value ?? 12)

  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
    throw new Error('BCRYPT_SALT_ROUNDS phải là số nguyên từ 10 đến 15')
  }

  return rounds
}

const parseSeatHoldMinutes = (value) => {
  const minutes = Number(value ?? 10)

  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) {
    throw new Error('SEAT_HOLD_MINUTES phải là số nguyên từ 1 đến 30')
  }

  return minutes
}

const parseBookingCancelBeforeMinutes = (value) => {
  const minutes = Number(value ?? 120)

  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new Error(
      'BOOKING_CANCEL_BEFORE_MINUTES phải là số nguyên dương',
    )
  }

  return minutes
}

const parsePositiveInteger = (value, fallback, name, maximum = 1440) => {
  const parsed = Number(value ?? fallback)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} phải là số nguyên từ 1 đến ${maximum}`)
  }

  return parsed
}

const env = Object.freeze({
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  seatHoldMinutes: parseSeatHoldMinutes(process.env.SEAT_HOLD_MINUTES),
  bookingCancelBeforeMinutes: parseBookingCancelBeforeMinutes(
    process.env.BOOKING_CANCEL_BEFORE_MINUTES,
  ),
  bookingPaymentExpiresMinutes: parsePositiveInteger(
    process.env.BOOKING_PAYMENT_EXPIRES_MINUTES,
    15,
    'BOOKING_PAYMENT_EXPIRES_MINUTES',
  ),
  bookingCleanupIntervalMinutes: parsePositiveInteger(
    process.env.BOOKING_CLEANUP_INTERVAL_MINUTES,
    1,
    'BOOKING_CLEANUP_INTERVAL_MINUTES',
  ),
  bookingCleanupBatchSize: parsePositiveInteger(
    process.env.BOOKING_CLEANUP_BATCH_SIZE,
    50,
    'BOOKING_CLEANUP_BATCH_SIZE',
    500,
  ),
  bcryptSaltRounds: parseBcryptSaltRounds(process.env.BCRYPT_SALT_ROUNDS),
  adminFullName: process.env.ADMIN_FULL_NAME || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPhone: process.env.ADMIN_PHONE || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
})

const validateStartupEnv = () => {
  const missingVariables = []

  if (!env.databaseUrl) {
    missingVariables.push('DATABASE_URL')
  }

  if (!env.jwtSecret) {
    missingVariables.push('JWT_SECRET')
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Thiếu biến môi trường bắt buộc: ${missingVariables.join(', ')}`,
    )
  }

  if (env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET phải có ít nhất 32 ký tự')
  }
}

export default env
export { validateStartupEnv }
