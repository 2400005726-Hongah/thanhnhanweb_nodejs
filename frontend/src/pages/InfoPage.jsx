import { useParams } from 'react-router-dom'

const CONTENT = {
  'gioi-thieu': {
    title: 'Giới thiệu Nhà xe Thành Nhân',
    paragraphs: [
      'Nhà xe Thành Nhân phục vụ hành khách trên các tuyến kết nối Đắk Lắk, Thành phố Hồ Chí Minh và các khu vực lân cận.',
      'Hệ thống hỗ trợ tìm chuyến, chọn ghế, đặt vé trực tuyến, tra cứu vé và quản lý hành trình thuận tiện.',
    ],
  },
  'lien-he': {
    title: 'Liên hệ',
    paragraphs: [
      'Hotline hỗ trợ đặt vé và giải đáp thông tin chuyến xe: vui lòng sử dụng số hotline hiển thị trên thanh đầu trang.',
      'Khi liên hệ, quý khách nên cung cấp mã vé và số điện thoại đã đặt để được hỗ trợ nhanh hơn.',
    ],
  },
  'huong-dan-dat-ve': {
    title: 'Hướng dẫn đặt vé',
    paragraphs: [
      'Chọn điểm đi, điểm đến và ngày khởi hành; chọn chuyến phù hợp; chọn ghế; nhập thông tin hành khách; kiểm tra lại và hoàn tất đặt vé.',
      'Sau khi đặt thành công, quý khách có thể tra cứu bằng mã vé và số điện thoại.',
    ],
  },
  'chinh-sach-huy-ve': {
    title: 'Chính sách hủy vé',
    paragraphs: [
      'Vé chỉ được hủy khi còn đủ thời gian trước giờ khởi hành theo quy định của hệ thống.',
      'Các khoản hoàn tiền trong đồ án được mô phỏng theo trạng thái thanh toán của vé.',
    ],
  },
  'bao-mat': {
    title: 'Chính sách bảo mật',
    paragraphs: [
      'Thông tin hành khách chỉ được sử dụng cho việc đặt vé, liên hệ phục vụ chuyến đi và quản lý vận hành.',
      'Không chia sẻ mã vé và số điện thoại tra cứu cho người không liên quan.',
    ],
  },
  'dieu-khoan': {
    title: 'Điều khoản sử dụng',
    paragraphs: [
      'Khách hàng cần cung cấp thông tin chính xác và có mặt đúng giờ tại điểm đón đã chọn.',
      'Nhà xe có quyền từ chối phục vụ các tài khoản hoặc khách hàng vi phạm quy định nhiều lần.',
    ],
  },
}

function InfoPage() {
  const { feature } = useParams()
  const content = CONTENT[feature] || {
    title: 'Thông tin',
    paragraphs: ['Nội dung đang được cập nhật.'],
  }

  return (
    <main className="container py-5">
      <section className="card border-0 shadow-sm p-4 p-lg-5">
        <h1 className="mb-4">{content.title}</h1>
        {content.paragraphs.map((paragraph) => (
          <p className="lead fs-6" key={paragraph}>{paragraph}</p>
        ))}
      </section>
    </main>
  )
}

export default InfoPage
