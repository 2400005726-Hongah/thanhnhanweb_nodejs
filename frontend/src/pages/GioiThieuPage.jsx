import './GioiThieuPage.css'

function GioiThieuPage() {
  return (
    <main className="tn-about-page">
      <section className="tn-about-hero">
        <div className="tn-about-container">
          <h1>Nhà xe Thành Nhân</h1>
          <p>Đồng hành cùng hành khách bằng sự an toàn, đúng giờ và tận tâm.</p>
        </div>
      </section>

      <section className="tn-about-container tn-about-content">
        <article className="tn-about-card">
          <h2>Giới thiệu chung</h2>
          <p>
            Nhà xe Thành Nhân là đơn vị vận tải hành khách phục vụ tuyến Krông Năng – Buôn Hồ – Sài Gòn,
            hướng đến sự an toàn, đúng giờ và thuận tiện trong mỗi chuyến đi. Nhà xe luôn chú trọng nâng cao
            chất lượng phương tiện, phục vụ hành khách chu đáo và từng bước ứng dụng công nghệ vào hoạt động
            đặt vé, quản lý chuyến xe. Thông qua website, khách hàng có thể dễ dàng tìm kiếm chuyến phù hợp,
            xem giờ khởi hành, giá vé, số chỗ còn trống, lựa chọn ghế hoặc phòng, điểm đón – trả, thanh toán
            và tra cứu lại thông tin vé khi cần. Hiện nay, Thành Nhân khai thác các dòng xe Giường nằm 34 giường
            và Limousine 22 phòng, đáp ứng nhiều nhu cầu di chuyển khác nhau của hành khách. Bên cạnh hình thức
            đặt vé Online, nhà xe vẫn duy trì hỗ trợ qua Hotline và tại quầy để khách hàng thuận tiện lựa chọn.
            Với phương châm lấy sự an tâm và hài lòng của hành khách làm trọng tâm, Nhà xe Thành Nhân mong muốn
            mỗi chuyến đi không chỉ là hành trình di chuyển mà còn là một trải nghiệm thoải mái, rõ ràng và
            đáng tin cậy.
          </p>
        </article>

        <div className="tn-about-values">
          <article>
            <h3>An toàn</h3>
            <p>Ưu tiên sự an tâm của hành khách trong suốt hành trình.</p>
          </article>

          <article>
            <h3>Đúng giờ</h3>
            <p>Cập nhật rõ lịch khởi hành và thông tin từng chuyến xe.</p>
          </article>

          <article>
            <h3>Tận tâm</h3>
            <p>Hỗ trợ khách hàng qua Website, Hotline và tại quầy.</p>
          </article>
        </div>
      </section>
    </main>
  )
}

export default GioiThieuPage
