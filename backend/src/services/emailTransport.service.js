import nodemailer from 'nodemailer'

import env from '../config/env.js'

let smtpTransporter = null

const hasCompleteSmtpConfiguration = () =>
  Boolean(
    env.emailEnabled &&
      env.smtpHost &&
      env.smtpUser &&
      env.smtpPassword &&
      env.emailFromAddress,
  )

const getSmtpTransporter = () => {
  if (!hasCompleteSmtpConfiguration()) return null
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPassword,
      },
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  }
  return smtpTransporter
}

const sendEmail = async (message, transporter = getSmtpTransporter()) => {
  if (!transporter) {
    return {
      sent: false,
      reasonCode: env.emailEnabled ? 'SMTP_NOT_CONFIGURED' : 'EMAIL_DISABLED',
    }
  }

  const result = await transporter.sendMail({
    from: {
      name: env.emailFromName,
      address: env.emailFromAddress,
    },
    ...message,
  })

  return { sent: true, messageId: result.messageId || null }
}

export { hasCompleteSmtpConfiguration, sendEmail }
