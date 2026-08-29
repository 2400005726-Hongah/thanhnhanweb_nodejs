import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const files = {
  info: read('frontend/src/pages/InfoPage.jsx'),
  header: read('frontend/src/components/layout/Header.jsx'),
  footer: read('frontend/src/components/layout/Footer.jsx'),
  home: read('frontend/src/pages/HomePage.jsx'),
  app: read('frontend/src/App.jsx'),
  newsList: read('frontend/src/pages/NewsListPage.jsx'),
  newsDetail: read('frontend/src/pages/NewsDetailPage.jsx'),
}

describe('Giai đoạn 9 - parity giao diện khách và nội dung hỗ trợ MVC', () => {
  test('có đủ bảy trang thông tin công khai của MVC', () => {
    for (const value of [
      'gioi-thieu',
      'lien-he',
      'quy-che-hoat-dong',
      'chinh-sach-huy-ve',
      'bao-mat',
      'dieu-khoan',
      'huong-dan-dat-ve',
    ]) expect(files.info).toContain(value)
  })

  test('hướng dẫn đặt vé giữ đúng sáu bước và điểm đón trả nhiều phương án', () => {
    expect(files.info).toContain('6 bước đặt vé')
    expect(files.info).toContain('Bước {index + 1}')
    expect(files.info).toContain('Limousine 22 phòng')
    expect(files.info).toContain('điểm hẹn/điểm dừng hoặc trung chuyển')
  })

  test('chính sách hủy nêu đúng hủy trước giờ, hoàn 100% và ngưỡng ba vi phạm', () => {
    expect(files.info).toContain('Trước giờ khởi hành')
    expect(files.info).toContain('hoàn 100%')
    expect(files.info).toContain('từ <strong>3 lần</strong>')
    expect(files.info).toContain('Không đi')
  })

  test('header/footer có Tin tức, hotline và thông tin liên hệ chuẩn MVC', () => {
    expect(files.header).toContain('/tin-tuc')
    expect(files.header).toContain('0979 406 406')
    expect(files.footer).toContain('hotro@thanhnhanweb.vn')
    expect(files.footer).toContain('/thong-tin/quy-che-hoat-dong')
    expect(files.footer).toContain('/thong-tin/huong-dan-dat-ve')
  })

  test('không còn route/liên kết đang phát triển trong ứng dụng công khai', () => {
    expect(files.home).toContain('/thong-tin/gioi-thieu')
    expect(files.home).not.toContain('/dang-phat-trien/gioi-thieu')
    expect(files.app).not.toContain('/dang-phat-trien/:feature')
    expect(files.app).not.toContain('ComingSoonPage')
  })

  test('tin tức công khai hiển thị ảnh, ngày đăng và lượt xem giống MVC', () => {
    expect(files.newsList).toContain('lượt xem')
    expect(files.newsList).toContain('thumbnailUrl || logoFallback')
    expect(files.newsDetail).toContain('createdBy?.fullName')
    expect(files.newsDetail).toContain('viewCount')
    expect(files.newsDetail).toContain('thumbnailUrl || logoFallback')
  })
})
