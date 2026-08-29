import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const files = {
  schema: read('backend/prisma/schema.prisma'),
  migration: read('backend/prisma/migrations/20260811000100_admin_parity/migration.sql'),
  adminRoutes: read('backend/src/routes/admin.routes.js'),
  adminService: read('backend/src/services/admin.service.js'),
  adminUsers: read('frontend/src/pages/admin/AdminUsersPage.jsx'),
  adminNews: read('frontend/src/pages/admin/AdminNewsPage.jsx'),
  newsValidator: read('backend/src/validators/news.validator.js'),
  newsService: read('backend/src/services/news.service.js'),
  app: read('backend/src/app.js'),
}

describe('Giai đoạn 10 - parity cuối và bảo toàn lịch sử', () => {
  test('xóa tài khoản quản trị có endpoint và không cho tự xóa', () => {
    expect(files.adminRoutes).toContain("router.delete(\n  '/users/:id'")
    expect(files.adminService).toContain("Không thể tự xóa tài khoản đang đăng nhập")
    expect(files.adminService).toContain('Không thể xóa Chủ xe hoạt động cuối cùng')
    expect(files.adminUsers).toContain('>Xóa</button>')
  })

  test('tài khoản có lịch sử được lưu trữ thay vì phá khóa ngoại', () => {
    expect(files.schema).toMatch(/enum UserStatus[\s\S]*ARCHIVED/)
    expect(files.migration).toContain("ALTER TYPE \"user_status\" ADD VALUE IF NOT EXISTS 'ARCHIVED'")
    expect(files.adminService).toContain("status: 'ARCHIVED'")
    expect(files.adminService).toContain("action: 'ARCHIVE_USER'")
  })

  test('quản lý tin tức cho phép chọn ảnh JPG PNG WEBP từ máy tối đa 5 MB', () => {
    expect(files.adminNews).toContain('Chọn ảnh từ máy')
    expect(files.adminNews).toContain("'image/jpeg', 'image/png', 'image/webp'")
    expect(files.adminNews).toContain('5 * 1024 * 1024')
    expect(files.newsValidator).toContain('data:image')
    expect(files.app).toContain("express.json({ limit: '7mb' })")
  })


  test('xóa tin tức là xóa mềm thật và không còn hiện ở danh sách', () => {
    expect(files.schema).toContain('deletedAt')
    expect(files.migration).toContain('deleted_at')
    expect(files.newsService).toContain('deletedAt: null')
    expect(files.newsService).toContain("action: 'DELETE_NEWS'")
  })

  test('ảnh URL cũ vẫn được giữ để tương thích dữ liệu hiện tại', () => {
    expect(files.adminNews).toContain('Hoặc dán URL ảnh https://...')
    expect(files.newsValidator).toContain('https?')
  })
})
