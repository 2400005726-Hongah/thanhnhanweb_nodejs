import { useParams } from 'react-router-dom'

import './InfoPage.css'

const INFO_PAGES = {
  'gioi-thieu': {
    title: 'Nhà xe Thành Nhân',
    subtitle: 'Đồng hành cùng hành khách bằng sự an toàn, đúng giờ và tận tâm.',
    type: 'about',
  },
  'lien-he': {
    title: 'Liên hệ',
    subtitle: 'Thông tin hỗ trợ dành cho hành khách Nhà xe Thành Nhân.',
    heading: 'Thông tin liên hệ',
    content:
      'Nhà xe Thành Nhân hỗ trợ hành khách trong quá trình tìm chuyến, đặt vé, tra cứu và xử lý các thông tin liên quan đến hành trình. Quý khách có thể liên hệ Hotline 0979.406.406 hoặc đến trực tiếp văn phòng nhà xe để được hỗ trợ.',
  },
  'quy-che-hoat-dong': {
    title: 'Quy chế hoạt động',
    subtitle: 'Nguyên tắc phục vụ và vận hành của Nhà xe Thành Nhân.',
    heading: 'Quy chế hoạt động',
    content:
      'Nhà xe Thành Nhân tổ chức hoạt động theo lịch chuyến, loại xe, giá vé và điểm phục vụ được công bố trên hệ thống. Hành khách cần cung cấp thông tin chính xác khi đặt vé và tuân thủ hướng dẫn tại điểm đón để quá trình phục vụ diễn ra thuận lợi.',
  },
  'quy-dinh-doi-huy-ve': {
    title: 'Quy định đổi / hủy vé',
    subtitle: 'Thông tin hỗ trợ hành khách khi có thay đổi kế hoạch.',
    heading: 'Quy định đổi / hủy vé',
    content:
      'Việc hủy vé được áp dụng theo trạng thái vé và thời điểm của chuyến. Vé chỉ có thể hủy khi còn đủ điều kiện theo hệ thống; các trường hợp đã qua giờ khởi hành hoặc không còn thuộc thời hạn xử lý sẽ được áp dụng theo quy định vận hành của nhà xe.',
  },
  'chinh-sach-bao-mat': {
    title: 'Chính sách bảo mật',
    subtitle: 'Bảo vệ thông tin khách hàng khi sử dụng website.',
    heading: 'Chính sách bảo mật',
    content:
      'Thông tin khách hàng được sử dụng cho mục đích đặt vé, liên hệ, thanh toán, tra cứu và hỗ trợ chuyến đi. Nhà xe Thành Nhân hạn chế sử dụng dữ liệu ngoài phạm vi cần thiết cho hoạt động phục vụ hành khách.',
  },
  'dieu-khoan-su-dung': {
    title: 'Điều khoản sử dụng',
    subtitle: 'Các nguyên tắc khi sử dụng hệ thống đặt vé trực tuyến.',
    heading: 'Điều khoản sử dụng',
    content:
      'Khi sử dụng website, hành khách cần nhập thông tin chính xác, lựa chọn đúng chuyến, vị trí và điểm phục vụ. Người dùng chịu trách nhiệm kiểm tra lại thông tin vé trước khi hoàn tất đặt vé và thực hiện theo các hướng dẫn được hiển thị trên hệ thống.',
  },
  'huong-dan-dat-ve-thanh-toan': {
    title: 'Hướng dẫn đặt vé / thanh toán',
    subtitle: 'Các bước cơ bản để hoàn tất một vé trên hệ thống.',
    heading: 'Hướng dẫn đặt vé',
    content:
      'Khách hàng chọn hành trình và ngày đi, chọn chuyến phù hợp, lựa chọn ghế hoặc phòng, chọn điểm đón – trả, nhập thông tin hành khách và thực hiện bước thanh toán. Sau khi hoàn tất, mã vé hoặc mã giao dịch có thể được dùng để tra cứu lại thông tin.',
  },
}

function AboutContent() {
  return (
    <>
      <article className="info-card info-about-card">
        <h2>Giới thiệu chung</h2>

        <p>
          Nhà xe Thành Nhân là đơn vị vận tải hành khách phục vụ tuyến
          {' '}Krông Năng – Buôn Hồ – Sài Gòn, hướng đến việc mang lại những
          chuyến đi an toàn, đúng giờ và thuận tiện cho hành khách. Trong quá
          trình hoạt động, nhà xe luôn chú trọng chất lượng phương tiện, thái
          độ phục vụ và sự rõ ràng trong thông tin chuyến đi để khách hàng có
          thể chủ động hơn khi lựa chọn hành trình.
        </p>

        <p>
          Hiện nay, Thành Nhân khai thác hai dòng xe chính gồm Giường nằm
          34 giường và Limousine 22 phòng, đáp ứng nhiều nhu cầu di chuyển khác
          nhau. Các chuyến xe được tổ chức theo lịch trình cụ thể, có thông tin
          về giờ khởi hành, giá vé, loại xe, vị trí còn trống và điểm đón – trả,
          giúp hành khách dễ dàng lựa chọn phương án phù hợp với nhu cầu của mình.
        </p>

        <p>
          Bên cạnh hình thức đặt vé trực tiếp tại quầy và qua Hotline, Nhà xe
          Thành Nhân từng bước ứng dụng công nghệ vào hoạt động phục vụ khách
          hàng. Thông qua website, hành khách có thể tìm kiếm chuyến xe, xem sơ
          đồ ghế hoặc phòng, lựa chọn điểm đón – trả, nhập thông tin, thực hiện
          thanh toán và tra cứu lại vé bằng mã vé hoặc mã giao dịch khi cần.
          Việc số hóa quy trình đặt vé giúp thao tác nhanh hơn, hạn chế nhầm lẫn
          và hỗ trợ nhà xe quản lý thông tin chuyến đi hiệu quả hơn.
        </p>

        <p>
          Với phương châm đặt sự an tâm và hài lòng của hành khách làm trọng
          tâm, Thành Nhân luôn cố gắng duy trì chất lượng phục vụ ổn định trong
          từng chuyến xe. Nhà xe mong muốn không chỉ đưa hành khách đến đúng
          điểm đến, mà còn tạo nên một hành trình thoải mái, thuận tiện và đáng
          tin cậy từ lúc đặt vé cho đến khi kết thúc chuyến đi.
        </p>
      </article>

      <div className="info-values">
        <article>
          <h3>An toàn</h3>
          <p>
            Chú trọng chất lượng phương tiện và sự an tâm của hành khách trong
            suốt hành trình.
          </p>
        </article>

        <article>
          <h3>Đúng giờ</h3>
          <p>
            Lịch khởi hành và thông tin chuyến xe được trình bày rõ ràng để
            hành khách chủ động sắp xếp thời gian.
          </p>
        </article>

        <article>
          <h3>Tận tâm</h3>
          <p>
            Hỗ trợ hành khách qua Website, Hotline và tại quầy trong quá trình
            tìm chuyến, đặt vé và tra cứu thông tin.
          </p>
        </article>
      </div>
    </>
  )
}

function InfoPage() {
  const { feature } = useParams()
  const page = INFO_PAGES[feature] || INFO_PAGES['gioi-thieu']

  return (
    <main className="info-page">
      <section className="info-hero">
        <div className="info-container">
          <h1>{page.title}</h1>
          <p>{page.subtitle}</p>
        </div>
      </section>

      <section className="info-container info-content">
        {page.type === 'about' ? (
          <AboutContent />
        ) : (
          <article className="info-card">
            <h2>{page.heading}</h2>
            <p>{page.content}</p>
          </article>
        )}
      </section>
    </main>
  )
}

export default InfoPage
