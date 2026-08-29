import env from '../config/env.js'
import {
  hasCompleteSmtpConfiguration,
  verifyEmailTransport,
} from '../services/emailTransport.service.js'

const maskedUser = env.smtpUser
  ? env.smtpUser.replace(/^(.{2}).*(@.*)$/u, '$1***$2')
  : '(chưa cấu hình)'

console.log('Kiểm tra cấu hình Email Nhà xe Thành Nhân')
console.log(`EMAIL_ENABLED: ${env.emailEnabled}`)
console.log(`SMTP_HOST: ${env.smtpHost || '(trống)'}`)
console.log(`SMTP_PORT: ${env.smtpPort}`)
console.log(`SMTP_SECURE: ${env.smtpSecure}`)
console.log(`SMTP_USER: ${maskedUser}`)
console.log(`EMAIL_FROM_ADDRESS: ${env.emailFromAddress || env.smtpUser || '(trống)'}`)
console.log(`Cấu hình đầy đủ: ${hasCompleteSmtpConfiguration() ? 'Có' : 'Không'}`)

const result = await verifyEmailTransport()

if (result.ok) {
  console.log('✅ Kết nối SMTP thành công. Backend có thể gửi Email.')
  process.exitCode = 0
} else {
  console.error(`❌ Kết nối SMTP thất bại: ${result.reasonCode}`)
  console.error('Kiểm tra EMAIL_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_USER và SMTP_PASSWORD trong backend/.env.')
  process.exitCode = 1
}
