import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const files = {
  schema: read('backend/prisma/schema.prisma'),
  adminService: read('backend/src/services/admin.service.js'),
  adminRoutes: read('backend/src/routes/admin.routes.js'),
  adminValidator: read('backend/src/validators/admin.validator.js'),
  customers: read('frontend/src/pages/admin/AdminCustomersPage.jsx'),
  users: read('frontend/src/pages/admin/AdminUsersPage.jsx'),
  audit: read('frontend/src/pages/admin/AdminAuditLogsPage.jsx'),
  newsService: read('backend/src/services/news.service.js'),
  newsPage: read('frontend/src/pages/admin/AdminNewsPage.jsx'),
}

describe('Giai đoạn 8 MVC parity - quản trị tổng hợp', () => {
  test('phân loại khách hàng VIP / Thường xuyên / Mới theo vé và chi tiêu', () => {
    expect(files.adminService).toContain('VIP_BOOKINGS: 10')
    expect(files.adminService).toContain('VIP_SPENDING: 5_000_000')
    expect(files.adminService).toContain('REGULAR_BOOKINGS: 3')
    expect(files.adminService).toContain('REGULAR_SPENDING: 1_500_000')
    expect(files.customers).toContain('Thường xuyên')
    expect(files.customers).toContain('Tổng chi tiêu')
  })

  test('khách hàng hỗ trợ lưu trữ 90 ngày và xuất Excel', () => {
    expect(files.schema).toContain('ARCHIVED')
    expect(files.adminService).toContain('ARCHIVE_AFTER_DAYS: 90')
    expect(files.adminRoutes).toContain("'/customers/export.xlsx'")
    expect(files.adminRoutes).toContain("router.delete(\n  '/customers/:id'")
    expect(files.customers).toContain('Xóa/Lưu trữ')
    expect(files.customers).toContain('Xuất Excel')
  })

  test('tài khoản quản trị có thể sửa và đặt lại mật khẩu bằng bcrypt backend', () => {
    expect(files.adminRoutes).toContain("router.patch(\n  '/users/:id'")
    expect(files.adminService).toContain('const updateManagedUser')
    expect(files.adminService).toContain('await hashPassword(payload.password)')
    expect(files.users).toContain('Mật khẩu mới (để trống nếu giữ nguyên)')
  })

  test('nhật ký hỗ trợ từ khóa và khoảng ngày như MVC', () => {
    expect(files.adminValidator).toContain("query('keyword')")
    expect(files.adminValidator).toContain("query('from').optional().isISO8601()")
    expect(files.adminValidator).toContain("query('to').optional().isISO8601()")
    expect(files.audit).toContain('Lọc nhật ký')
    expect(files.audit).toContain('Từ ngày')
    expect(files.audit).toContain('Đến ngày')
  })

  test('tin tức lưu và tăng lượt xem khi khách mở bài đã đăng', () => {
    expect(files.schema).toContain('viewCount')
    expect(files.newsService).toContain('const getPublicNewsById')
    expect(files.newsService).toContain('viewCount: { increment: 1 }')
    expect(files.newsPage).toContain('Lượt xem')
  })
})
