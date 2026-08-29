import nodemailer from 'nodemailer'

import env from '../config/env.js'

let smtpTransporter = null

const isGmailSmtp = () => env.smtpHost.trim().toLowerCase() === 'smtp.gmail.com'

const getFromAddress = () =>
  (env.emailFromAddress || env.smtpUser || '').trim()

const getSmtpPassword = () => {
  const rawPassword = String(env.smtpPassword || '')
  // Google thường hiển thị App Password theo từng nhóm. Chỉ Gmail mới bỏ khoảng trắng.
  return isGmailSmtp() ? rawPassword.replace(/\s+/g, '') : rawPassword
}

const hasCompleteSmtpConfiguration = () =>
  Boolean(
    env.emailEnabled &&
      env.smtpHost?.trim() &&
      env.smtpUser?.trim() &&
      getSmtpPassword() &&
      getFromAddress(),
  )

const buildSmtpOptions = () => {
  const secure = env.smtpPort === 465 ? true : env.smtpSecure

  return {
    host: env.smtpHost.trim(),
    port: env.smtpPort,
    secure,
    ...(env.smtpPort === 587 && !secure ? { requireTLS: true } : {}),
    auth: {
      user: env.smtpUser.trim(),
      pass: getSmtpPassword(),
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

const getSmtpTransporter = () => {
  if (!hasCompleteSmtpConfiguration()) return null

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport(buildSmtpOptions())
  }

  return smtpTransporter
}

const getUnavailableReason = () =>
  env.emailEnabled ? 'SMTP_NOT_CONFIGURED' : 'EMAIL_DISABLED'

const verifyEmailTransport = async (transporter = getSmtpTransporter()) => {
  if (!transporter) {
    return { ok: false, reasonCode: getUnavailableReason() }
  }

  try {
    await transporter.verify()
    return { ok: true, reasonCode: null }
  } catch (error) {
    return {
      ok: false,
      reasonCode: error?.code || error?.command || 'SMTP_VERIFY_FAILED',
    }
  }
}

const sendEmail = async (message, transporter = getSmtpTransporter()) => {
  if (!transporter) {
    return {
      sent: false,
      reasonCode: getUnavailableReason(),
    }
  }

  const result = await transporter.sendMail({
    from: {
      name: env.emailFromName,
      address: getFromAddress(),
    },
    ...message,
  })

  return { sent: true, messageId: result.messageId || null }
}

export {
  buildSmtpOptions,
  hasCompleteSmtpConfiguration,
  sendEmail,
  verifyEmailTransport,
}
