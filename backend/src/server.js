import app from './app.js'
import {
  connectDatabase,
  disconnectDatabase,
} from './config/database.js'
import env, { validateStartupEnv } from './config/env.js'
import {
  startBookingCleanupJob,
  stopBookingCleanupJob,
} from './jobs/bookingCleanup.js'

let server
let isShuttingDown = false

const startServer = async () => {
  validateStartupEnv()
  await connectDatabase()

  server = app.listen(env.port, () => {
    console.log(
      `NHÀ XE THÀNH NHÂN API đang chạy tại http://localhost:${env.port}`,
    )
  })
  startBookingCleanupJob()

  server.on('error', async (error) => {
    console.error(
      `Không thể khởi động HTTP server (${error.code || 'UNKNOWN_ERROR'})`,
    )
    await stopBookingCleanupJob()
    await disconnectDatabase()
    process.exitCode = 1
  })

  return server
}

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  await stopBookingCleanupJob()
  console.log(`Đang dừng server theo tín hiệu ${signal}...`)

  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }

    await disconnectDatabase()
    console.log('Đã đóng HTTP server và kết nối Supabase PostgreSQL')
  } catch (error) {
    console.error('Không thể dừng server an toàn:', error.message)
    process.exitCode = 1
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT')
})

process.once('SIGTERM', () => {
  void shutdown('SIGTERM')
})

try {
  await startServer()
} catch (error) {
  const startupMessage =
    error.message.startsWith('Thiếu biến môi trường bắt buộc:') ||
    error.message.startsWith('JWT_SECRET ') ||
    error.message === 'DATABASE_URL chưa được cấu hình'
      ? error.message
      : 'Server không được khởi động do kết nối Supabase PostgreSQL thất bại'

  console.error(startupMessage)
  process.exitCode = 1
}

export default server
export { shutdown, startServer }
