import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: {} }))

const { cleanContent, makeSlug } = await import(
  '../src/services/news.service.js'
)

describe('News content security', () => {
  test('removes scripts, inline handlers, and javascript URLs', () => {
    const content = cleanContent(`
      <p onclick="alert(1)">Nội dung an toàn</p>
      <script>alert('xss')</script>
      <a href="javascript:alert(1)">Liên kết xấu</a>
      <strong>Được giữ</strong>
    `)

    expect(content).toContain('<p>Nội dung an toàn</p>')
    expect(content).toContain('<strong>Được giữ</strong>')
    expect(content).not.toMatch(/script|onclick|javascript:/i)
  })

  test('creates a stable Vietnamese slug', () => {
    expect(makeSlug('Nhà xe Thành Nhân – An toàn!')).toBe(
      'nha-xe-thanh-nhan-an-toan',
    )
  })
})
