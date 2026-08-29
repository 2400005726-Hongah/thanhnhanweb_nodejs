import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'
process.env.EMAIL_ENABLED = 'true'
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASSWORD = 'smtp-secret-must-not-leak'
process.env.EMAIL_FROM_ADDRESS = ''

const { hasCompleteSmtpConfiguration, sendEmail } = await import(
  '../src/services/emailTransport.service.js'
)

describe('Phase 5 Email transport configuration', () => {
  test('missing SMTP settings never crash the server or expose the secret', async () => {
    expect(hasCompleteSmtpConfiguration()).toBe(false)

    const result = await sendEmail({
      to: 'passenger@example.com',
      subject: 'Vé điện tử',
      text: 'Nội dung',
    })

    expect(result).toEqual({ sent: false, reasonCode: 'SMTP_NOT_CONFIGURED' })
    expect(JSON.stringify(result)).not.toContain('smtp-secret-must-not-leak')
  })

  test('uses an injected transporter in tests without a live SMTP connection', async () => {
    const transporter = {
      sendMail: jest.fn(async () => ({ messageId: 'test-message-id' })),
    }

    await expect(
      sendEmail(
        {
          to: 'passenger@example.com',
          subject: 'Vé điện tử',
          text: 'Nội dung',
          html: '<p>Nội dung</p>',
        },
        transporter,
      ),
    ).resolves.toEqual({ sent: true, messageId: 'test-message-id' })
    expect(transporter.sendMail).toHaveBeenCalledTimes(1)
  })
})

test('verifyEmailTransport can verify an injected SMTP transporter safely', async () => {
  const { verifyEmailTransport } = await import(
    '../src/services/emailTransport.service.js'
  )
  const transporter = {
    verify: jest.fn(async () => true),
  }

  await expect(verifyEmailTransport(transporter)).resolves.toEqual({
    ok: true,
    reasonCode: null,
  })
  expect(transporter.verify).toHaveBeenCalledTimes(1)
})
