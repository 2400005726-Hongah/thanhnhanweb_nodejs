import { Link, NavLink, useParams } from 'react-router-dom'

import '../styles/InfoPage.css'

const SUPPORT_LINKS = [
  ['quy-che-hoat-dong', 'Quy định chung'],
  ['chinh-sach-huy-ve', 'Đổi / hủy vé'],
  ['bao-mat', 'Bảo mật thông tin'],
  ['dieu-khoan', 'Điều khoản sử dụng'],
  ['huong-dan-dat-ve', 'Hướng dẫn đặt vé'],
]

const FEATURE_ALIASES = {
  'chinh-sach-bao-mat': 'bao-mat',
  'dieu-khoan-su-dung': 'dieu-khoan',
  'quy-che': 'quy-che-hoat-dong',
}

function SupportNav() {
  return (
    <aside className="support-nav" aria-label="Hỗ trợ hành khách">
      <div className="support-nav-title">Hỗ trợ hành khách</div>
      {SUPPORT_LINKS.map(([path, label]) => (
        <NavLink key={path} to={`/thong-tin/${path}`}>{label}</NavLink>
      ))}
    </aside>
  )
}

function SupportShell({ kicker, title, description, actions, children }) {
  return (
    <div className="support-page">
      <section className="support-hero">
        <div className="support-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        {actions && <div className="support-hero-actions">{actions}</div>}
      </section>
      <div className="support-layout">
        <SupportNav />
        <main className="support-content">{children}</main>
      </div>
    </div>
  )
}

function GeneralRules() {
  return (
    <SupportShell
      kicker="Nhà xe Thành Nhân"
      title="Một vài lưu ý để chuyến đi của bạn thuận lợi hơn"
      description="Từ lúc đặt vé đến khi lên xe, chỉ cần kiểm tra đúng chuyến, đúng giờ và đúng điểm đón. Phần này tổng hợp những thông tin quan trọng nhất dành cho hành khách Thành Nhân."
      actions={(
        <>
          <Link className="btn btn-light" to="/tim-chuyen">Tìm chuyến</Link>
          <Link className="btn btn-outline-light" to="/tra-cuu-ve">Tra cứu vé</Link>
        </>
      )}
    >
      <section className="support-card">
        <div className="support-eyebrow">Trước khi đặt vé</div>
        <h2>Kiểm tra 4 thông tin quan trọng</h2>
        <div className="support-grid-2">
          <div className="support-mini"><strong>Hành trình</strong><span>Chọn đúng tỉnh/thành đi, tỉnh/thành đến và ngày khởi hành.</span></div>
          <div className="support-mini"><strong>Giờ xuất bến</strong><span>Giờ hiển thị trên chuyến là mốc để bạn chủ động thời gian có mặt.</span></div>
          <div className="support-mini"><strong>Điểm đón / trả</strong><span>Mỗi chuyến có thể có điểm chính, điểm hẹn, điểm dừng hoặc trung chuyển.</span></div>
          <div className="support-mini"><strong>Thông tin liên hệ</strong><span>Nhập đúng họ tên, số điện thoại và email để nhà xe có thể liên hệ khi cần.</span></div>
        </div>
      </section>
      <section className="support-card">
        <div className="support-eyebrow">Khi đặt vé</div>
        <h2>Ghế/phòng được giữ trong thời gian hoàn tất đặt vé</h2>
        <p>Sau khi chọn chỗ, bạn có một khoảng thời gian giới hạn để hoàn tất thông tin và thanh toán. Khi thời gian giữ chỗ kết thúc mà vé chưa được hoàn tất, vị trí có thể được mở lại để hành khách khác đặt.</p>
        <div className="support-note"><strong>Mẹo nhỏ:</strong><div>Trước khi chọn ghế, hãy chuẩn bị sẵn số điện thoại, email và điểm đón mong muốn để thao tác nhanh hơn.</div></div>
      </section>
      <section className="support-card">
        <div className="support-eyebrow">Trước giờ khởi hành</div>
        <h2>Đến đúng điểm, đúng giờ</h2>
        <ul className="support-checklist">
          <li>Kiểm tra lại vé và điểm đón đã chọn trước ngày đi.</li>
          <li>Nếu tập trung tại văn phòng hoặc điểm chính, nên có mặt sớm để nhân viên hỗ trợ lên xe.</li>
          <li>Nếu sử dụng điểm hẹn hoặc trung chuyển, vui lòng chú ý thời gian dự kiến hiển thị trên vé và giữ điện thoại liên lạc.</li>
          <li>Khi cần thay đổi thông tin chuyến đi, hãy liên hệ nhà xe trước giờ khởi hành để được kiểm tra khả năng hỗ trợ.</li>
        </ul>
      </section>
      <section className="support-card">
        <div className="support-eyebrow">Vé điện tử</div>
        <h2>Khi nào vé được xem là đã đặt thành công?</h2>
        <p>Khi website thông báo đặt vé thành công, vé đã được ghi nhận trong hệ thống. Bạn nên lưu lại <strong>mã vé hoặc mã giao dịch</strong> để tra cứu khi cần. Email xác nhận là một kênh tiện lợi để nhận thông tin chuyến, nhưng nếu chưa thấy email, bạn vẫn có thể dùng chức năng Tra cứu vé trên website.</p>
        <div className="support-actions">
          <Link className="btn btn-danger" to="/tra-cuu-ve">Tra cứu vé của tôi</Link>
          <Link className="btn btn-outline-secondary" to="/thong-tin/lien-he">Liên hệ nhà xe</Link>
        </div>
      </section>
    </SupportShell>
  )
}

function CancellationPolicy() {
  return (
    <SupportShell
      kicker="Hỗ trợ thay đổi chuyến đi"
      title="Kế hoạch thay đổi? Hãy xử lý vé càng sớm càng tốt"
      description="Thành Nhân hỗ trợ hủy vé trước giờ khởi hành. Quyền lợi hoàn tiền phụ thuộc vào việc vé đã được thanh toán hay chưa và thời điểm yêu cầu được thực hiện."
      actions={<Link className="btn btn-light" to="/tra-cuu-ve">Tra cứu / hủy vé</Link>}
    >
      <section className="support-card">
        <h2>Chính sách hủy vé hiện tại</h2>
        <div className="support-grid-3">
          <div className="support-mini"><strong>Trước giờ khởi hành</strong><span>Bạn có thể yêu cầu hủy vé khi chuyến chưa đến giờ xuất bến.</span></div>
          <div className="support-mini"><strong>Vé đã thanh toán</strong><span>Khi hủy hợp lệ, khoản tiền đã thanh toán được ghi nhận hoàn 100%.</span></div>
          <div className="support-mini"><strong>Sau giờ khởi hành</strong><span>Vé không còn thuộc trường hợp hủy thông thường và không tự động hoàn tiền.</span></div>
        </div>
      </section>
      <section className="support-card">
        <h2>Từng trường hợp cụ thể</h2>
        <div className="support-row"><div className="support-number">01</div><div className="body"><h3>Vé chưa thanh toán</h3><p>Nếu hủy trước giờ khởi hành, vé được hủy và chỗ được mở lại. Vì chưa thu tiền nên không phát sinh khoản hoàn.</p></div></div>
        <div className="support-row"><div className="support-number">02</div><div className="body"><h3>Vé đã thanh toán</h3><p>Nếu hủy trước giờ khởi hành, vé được ghi nhận hủy và khoản tiền đã thanh toán được ghi nhận hoàn 100% theo chính sách hiện tại của Nhà xe Thành Nhân.</p></div></div>
        <div className="support-row"><div className="support-number">03</div><div className="body"><h3>Chuyến đã đến giờ xuất bến</h3><p>Khách không còn thao tác hủy vé theo quy trình thông thường. Nếu không có mặt, vé có thể được ghi nhận là <strong>Không đi</strong> và không tự động hoàn tiền.</p></div></div>
      </section>
      <section className="support-card">
        <h2>Cần đổi chuyến, giờ đi hoặc vị trí?</h2>
        <p>Website hiện ưu tiên quy trình rõ ràng: kiểm tra vé hiện tại trước, sau đó hỗ trợ theo tình trạng chỗ của chuyến mới. Nếu bạn cần đổi chuyến, giờ đi, ghế/phòng hoặc điểm đón/trả, hãy liên hệ nhà xe <strong>trước giờ khởi hành</strong> để được kiểm tra phương án phù hợp.</p>
        <div className="support-note success"><strong>Lưu ý:</strong><div>Việc đổi sang chuyến khác phụ thuộc vào chỗ còn trống và điều kiện của vé tại thời điểm hỗ trợ.</div></div>
      </section>
      <section className="support-card">
        <h2>Lưu ý về lịch sử hủy vé / không đi</h2>
        <p>Để hạn chế việc giữ chỗ nhưng không sử dụng, hệ thống có theo dõi các vé <strong>Đã hủy</strong> và <strong>Không đi</strong>. Khi một số điện thoại có từ <strong>3 lần</strong> thuộc các trường hợp này, quyền tạo vé mới có thể bị tạm chặn trên các kênh đặt vé của nhà xe.</p>
        <div className="support-note danger"><strong>Cần kiểm tra?</strong><div>Nếu bạn cho rằng trạng thái được ghi nhận chưa chính xác, hãy liên hệ nhà xe để được kiểm tra lịch sử vé.</div></div>
        <div className="support-actions"><Link className="btn btn-danger" to="/tra-cuu-ve">Kiểm tra vé</Link><Link className="btn btn-outline-secondary" to="/thong-tin/lien-he">Liên hệ hỗ trợ</Link></div>
      </section>
      <section className="support-card support-faq">
        <h2>Câu hỏi thường gặp</h2>
        <details><summary>Hủy vé trước giờ chạy có mất chỗ ngay không?</summary><div className="answer">Sau khi hủy được xác nhận, vị trí trên chuyến được giải phóng để có thể phục vụ hành khách khác.</div></details>
        <details><summary>Tôi đã thanh toán nhưng chưa thấy tiền hoàn ngay thì sao?</summary><div className="answer">Trạng thái hoàn tiền được ghi nhận theo vé. Thời gian tiền thực tế về phương thức thanh toán có thể phụ thuộc vào kênh xử lý; khi cần đối chiếu, hãy cung cấp mã vé hoặc mã giao dịch cho nhà xe.</div></details>
        <details><summary>Tôi không đi nhưng cũng không hủy vé trước giờ chạy thì sao?</summary><div className="answer">Sau giờ khởi hành, vé có thể được nhân viên cập nhật trạng thái Không đi. Trường hợp này không tự động phát sinh hoàn tiền.</div></details>
      </section>
    </SupportShell>
  )
}

function PrivacyPolicy() {
  return (
    <SupportShell
      kicker="Quyền riêng tư của hành khách"
      title="Thông tin của bạn được dùng để phục vụ chuyến đi"
      description="Khi đặt vé, bạn cần cung cấp một số thông tin để nhà xe xác nhận hành khách, liên hệ khi cần và hỗ trợ tra cứu sau này. Thành Nhân sử dụng các thông tin này trong phạm vi phục vụ đặt vé và vận chuyển."
    >
      <section className="support-card">
        <h2>Những thông tin có thể được thu thập</h2>
        <div className="support-grid-2">
          <div className="support-mini"><strong>Thông tin liên hệ</strong><span>Họ tên, số điện thoại, email do bạn cung cấp khi đặt vé.</span></div>
          <div className="support-mini"><strong>Thông tin chuyến đi</strong><span>Chuyến xe, ghế/phòng, ngày giờ đi, nguồn đặt và trạng thái vé.</span></div>
          <div className="support-mini"><strong>Thông tin đón / trả</strong><span>Điểm đón, điểm trả hoặc địa chỉ trung chuyển do bạn lựa chọn.</span></div>
          <div className="support-mini"><strong>Thông tin giao dịch</strong><span>Phương thức thanh toán, trạng thái thanh toán, số tiền và mã giao dịch liên quan đến vé.</span></div>
        </div>
      </section>
      <section className="support-card">
        <h2>Thông tin được sử dụng để làm gì?</h2>
        <ul className="support-checklist">
          <li>Xác nhận và quản lý vé của bạn.</li><li>Gửi thông tin vé và chuyến đi qua các kênh liên hệ bạn đã cung cấp.</li><li>Hỗ trợ đón/trả khách đúng phương án đã chọn.</li><li>Tra cứu, hỗ trợ hủy vé, hoàn tiền và xử lý yêu cầu liên quan đến chuyến đi.</li><li>Đối chiếu giao dịch và giải quyết phản hồi khi có phát sinh.</li>
        </ul>
      </section>
      <section className="support-card">
        <h2>Nguyên tắc sử dụng thông tin</h2>
        <div className="support-quote">Nhà xe Thành Nhân không yêu cầu bạn cung cấp nhiều thông tin hơn mức cần thiết cho việc đặt vé và phục vụ chuyến đi. Thông tin hành khách không được sử dụng tùy tiện ngoài mục đích dịch vụ, trừ trường hợp cần thiết để thực hiện nghĩa vụ pháp lý hoặc bảo vệ quyền lợi hợp pháp liên quan.</div>
        <div className="support-meta"><span>Đúng mục đích</span><span>Hạn chế truy cập</span><span>Có lịch sử đối chiếu</span></div>
      </section>
      <section className="support-card">
        <h2>Bạn có thể làm gì với thông tin của mình?</h2>
        <p>Nếu phát hiện thông tin liên hệ hoặc thông tin hành khách chưa chính xác, bạn có thể liên hệ nhà xe để được kiểm tra và hỗ trợ điều chỉnh trong phạm vi phù hợp. Với dữ liệu đã gắn với chuyến đi hoàn tất hoặc giao dịch đã phát sinh, một số thông tin cần được giữ lại để bảo đảm việc tra cứu và đối chiếu lịch sử.</p>
        <div className="support-actions"><Link className="btn btn-danger" to="/thong-tin/lien-he">Liên hệ hỗ trợ</Link></div>
      </section>
    </SupportShell>
  )
}

function TermsOfUse() {
  return (
    <SupportShell
      kicker="Điều khoản sử dụng website"
      title="Đặt vé rõ ràng, đi xe đúng thông tin"
      description="Những điều khoản dưới đây giúp hành khách và nhà xe cùng hiểu một cách thống nhất về thông tin vé, thời gian giữ chỗ, thanh toán và trách nhiệm khi sử dụng website Thành Nhân."
    >
      <section className="support-card"><h2>1. Khi sử dụng website</h2><p>Bằng việc tìm chuyến, đặt vé hoặc sử dụng các chức năng tra cứu trên website, bạn đồng ý cung cấp thông tin chính xác và sử dụng dịch vụ đúng mục đích đặt vé xe của Nhà xe Thành Nhân.</p></section>
      <section className="support-card"><h2>2. Trách nhiệm của hành khách khi đặt vé</h2><ul className="support-checklist"><li>Kiểm tra hành trình, ngày đi, giờ khởi hành, loại xe và giá vé trước khi xác nhận.</li><li>Nhập đúng họ tên, số điện thoại và email để nhận thông tin chuyến và hỗ trợ khi cần.</li><li>Chọn đúng điểm đón/trả; với trung chuyển, cần cung cấp địa chỉ đủ rõ để nhà xe tiếp nhận.</li><li>Không cố ý giữ nhiều chỗ nhưng không sử dụng hoặc cung cấp thông tin không đúng để tạo vé.</li></ul></section>
      <section className="support-card"><h2>3. Giữ chỗ và xác nhận vé</h2><p>Khi bạn chọn ghế/phòng, vị trí được giữ trong một khoảng thời gian để hoàn tất đặt vé. Hết thời gian giữ mà quy trình chưa hoàn thành, chỗ có thể trở lại trạng thái còn trống. Vé được xem là đã ghi nhận khi website thông báo đặt vé thành công.</p><div className="support-note success"><strong>Hãy lưu mã vé hoặc mã giao dịch.</strong><div>Đây là thông tin hữu ích nhất khi bạn cần tra cứu hoặc liên hệ hỗ trợ.</div></div></section>
      <section className="support-card"><h2>4. Giá vé và thanh toán</h2><p>Giá hiển thị tại chuyến là giá áp dụng cho hành trình và loại chỗ tương ứng. Một số dòng xe có thể có nhiều loại phòng với mức giá khác nhau. Trước khi hoàn tất, bạn nên kiểm tra lại tổng tiền và phương thức thanh toán đã chọn.</p><p>Trạng thái <strong>vé</strong> và trạng thái <strong>thanh toán</strong> là hai thông tin riêng. Vì vậy một vé có thể đã được đặt nhưng vẫn đang chờ thu tiền theo phương thức đã chọn.</p></section>
      <section className="support-card"><h2>5. Thay đổi, hủy vé và không đi</h2><p>Việc hủy vé thực hiện theo <strong>Quy định đổi trả - hủy vé</strong> được công bố trên website. Sau giờ khởi hành, vé không còn thuộc trường hợp hủy thông thường. Hành khách không có mặt có thể được ghi nhận là Không đi.</p><div className="support-actions"><Link className="btn btn-outline-danger" to="/thong-tin/chinh-sach-huy-ve">Xem quy định hủy vé</Link></div></section>
      <section className="support-card"><h2>6. Khi cần hỗ trợ</h2><p>Nếu thông tin trên vé không đúng, chưa nhận được email xác nhận hoặc cần kiểm tra một giao dịch, bạn nên liên hệ nhà xe và cung cấp mã vé/mã giao dịch cùng số điện thoại đã dùng khi đặt vé.</p><div className="support-actions"><Link className="btn btn-danger" to="/thong-tin/lien-he">Liên hệ Thành Nhân</Link><Link className="btn btn-outline-secondary" to="/tra-cuu-ve">Tra cứu trước</Link></div></section>
    </SupportShell>
  )
}

function BookingGuide() {
  const steps = [
    ['Tìm chuyến phù hợp', 'Chọn tỉnh/thành đi, tỉnh/thành đến và ngày khởi hành. Bạn có thể dùng bộ lọc để thu hẹp theo giờ, giá hoặc khu vực đón/trả.'],
    ['Chọn ghế hoặc phòng', 'Mở sơ đồ chỗ và chọn vị trí còn trống. Với dòng Limousine 22 phòng, giá có thể khác nhau giữa phòng đơn và phòng đôi; xe 34 phòng áp dụng mức giá của chuyến.'],
    ['Chọn điểm đón và điểm trả', 'Tùy chuyến, bạn có thể chọn điểm chính, điểm hẹn/điểm dừng hoặc trung chuyển. Thời gian tại các điểm phụ là thời gian dự kiến để bạn chủ động sắp xếp.'],
    ['Điền thông tin hành khách', 'Nhập đúng họ tên, số điện thoại và email. Đây là thông tin nhà xe dùng để xác nhận vé và hỗ trợ khi chuyến đi có phát sinh.'],
    ['Chọn phương thức thanh toán', 'Kiểm tra tổng tiền và chọn phương thức đang được website cung cấp. Một số vé có thể thanh toán trước, một số trường hợp được ghi nhận chờ thu tiền theo phương án của nhà xe.'],
    ['Lưu vé và kiểm tra lại chuyến', 'Sau khi đặt thành công, lưu mã vé/mã giao dịch. Bạn có thể tra cứu lại ngày giờ đi, ghế/phòng, điểm đón/trả và tình trạng thanh toán bất cứ khi nào cần.'],
  ]
  return (
    <SupportShell
      kicker="Đặt vé trực tuyến"
      title="Từ tìm chuyến đến nhận vé chỉ trong vài bước"
      description="Bạn có thể tự chọn chuyến, ghế/phòng và điểm đón/trả ngay trên website. Hãy làm lần lượt theo hướng dẫn dưới đây để tránh chọn nhầm chuyến hoặc bỏ lỡ thời gian giữ chỗ."
      actions={<Link className="btn btn-light" to="/tim-chuyen">Bắt đầu đặt vé</Link>}
    >
      <section className="support-card"><h2>6 bước đặt vé</h2><div className="support-timeline">{steps.map(([title, text], index) => <div className="support-step" key={title}><div className="step-label">Bước {index + 1}</div><h3>{title}</h3><p>{text}</p></div>)}</div></section>
      <section className="support-card"><h2>Điểm đón / trả: chọn thế nào cho đúng?</h2><div className="support-grid-2"><div className="support-mini"><strong>Điểm đón</strong><span>Điểm chính của chuyến, xe trung chuyển hoặc một điểm hẹn được nhà xe công bố.</span></div><div className="support-mini"><strong>Điểm trả</strong><span>Điểm chính tại nơi đến, xe trung chuyển hoặc điểm dừng phù hợp trên hành trình.</span></div></div><div className="support-note"><strong>Thời gian dự kiến:</strong><div>Giờ tại điểm hẹn/điểm dừng là thời gian dự kiến. Bạn nên chủ động có mặt sớm và giữ điện thoại liên lạc.</div></div></section>
      <section className="support-card"><h2>Trước khi bấm xác nhận, kiểm tra lại</h2><ul className="support-checklist"><li>Đúng ngày và giờ xuất bến.</li><li>Đúng chiều đi và điểm đến.</li><li>Đúng ghế/phòng và mức giá.</li><li>Đúng điểm đón, điểm trả hoặc địa chỉ trung chuyển.</li><li>Đúng số điện thoại và email.</li></ul></section>
      <section className="support-card support-faq"><h2>Câu hỏi thường gặp khi đặt vé</h2><details><summary>Tôi không nhận được email vé thì có mất vé không?</summary><div className="answer">Không nhất thiết. Nếu website đã báo đặt vé thành công, hãy dùng mã vé/mã giao dịch và số điện thoại để tra cứu. Khi cần, nhà xe có thể hỗ trợ kiểm tra lại thông tin.</div></details><details><summary>Tại sao ghế tôi vừa xem lại có người đặt?</summary><div className="answer">Chỗ ngồi được nhiều hành khách xem cùng lúc. Khi một người đã hoàn tất giữ/đặt chỗ trước, vị trí đó sẽ không còn khả dụng cho người khác.</div></details><details><summary>Tôi có thể đổi điểm đón sau khi đặt không?</summary><div className="answer">Bạn nên liên hệ nhà xe trước giờ khởi hành. Việc thay đổi phụ thuộc vào các điểm mà chuyến đó đang phục vụ và tình trạng thực tế của chuyến.</div></details></section>
      <section className="support-card"><h2>Đã có vé?</h2><p>Tra cứu lại trước ngày đi để chắc chắn bạn nhớ đúng giờ và điểm đón.</p><div className="support-actions"><Link className="btn btn-danger" to="/tra-cuu-ve">Tra cứu vé</Link><Link className="btn btn-outline-secondary" to="/thong-tin/chinh-sach-huy-ve">Xem quy định hủy vé</Link></div></section>
    </SupportShell>
  )
}

function AboutPage() {
  return (
    <div className="public-info-page">
      <section className="public-info-hero"><h1>Nhà xe Thành Nhân</h1><p>Đồng hành cùng hành khách bằng sự an toàn, đúng giờ và tận tâm.</p></section>
      <section className="public-info-card"><h2>Giới thiệu chung</h2><p>Nhà xe Thành Nhân xây dựng hệ thống đặt vé trực tuyến giúp hành khách tìm chuyến, chọn vị trí, thanh toán và tra cứu thông tin vé.</p><p>Thông tin chuyến đi, giá vé và tình trạng ghế được cập nhật theo dữ liệu quản lý của nhà xe.</p></section>
      <section className="public-info-values"><article><strong>An toàn</strong><p>Ưu tiên an toàn của hành khách trong suốt hành trình.</p></article><article><strong>Đúng giờ</strong><p>Minh bạch ngày giờ khởi hành và thông tin chuyến xe.</p></article><article><strong>Tận tâm</strong><p>Hỗ trợ hành khách qua website, Hotline và tại quầy.</p></article></section>
    </div>
  )
}

function ContactPage() {
  return (
    <div className="public-info-page">
      <section className="public-info-hero"><h1>Thông tin liên hệ</h1><p>Liên hệ Nhà xe Thành Nhân để được hỗ trợ về chuyến đi và vé xe.</p></section>
      <section className="contact-layout">
        <div className="public-info-card contact-details"><h2>Nhà xe Thành Nhân</h2><p><strong>Văn phòng chính</strong><br />Buôn Hồ, Đắk Lắk</p><p><strong>Hotline</strong><br /><a href="tel:0979406406">0979 406 406</a></p><p><strong>Email</strong><br /><a href="mailto:hotro@thanhnhanweb.vn">hotro@thanhnhanweb.vn</a></p><div className="support-note danger"><div>Khi cần hỗ trợ vé, vui lòng cung cấp mã vé hoặc số điện thoại đã dùng lúc đặt vé.</div></div></div>
        <div className="contact-map"><iframe title="Bản đồ Buôn Hồ, Đắk Lắk" src="https://www.google.com/maps?q=Bu%C3%B4n%20H%E1%BB%93%2C%20%C4%90%E1%BA%AFk%20L%E1%BA%AFk&output=embed" width="100%" height="420" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
      </section>
    </div>
  )
}

function InfoPage() {
  const { feature: rawFeature } = useParams()
  const feature = FEATURE_ALIASES[rawFeature] || rawFeature

  if (feature === 'gioi-thieu') return <AboutPage />
  if (feature === 'lien-he') return <ContactPage />
  if (feature === 'quy-che-hoat-dong') return <GeneralRules />
  if (feature === 'chinh-sach-huy-ve') return <CancellationPolicy />
  if (feature === 'bao-mat') return <PrivacyPolicy />
  if (feature === 'dieu-khoan') return <TermsOfUse />
  if (feature === 'huong-dan-dat-ve') return <BookingGuide />

  return (
    <div className="public-info-page">
      <section className="public-info-card">
        <h1>Không tìm thấy nội dung</h1>
        <p>Trang thông tin bạn yêu cầu không tồn tại hoặc đã được thay đổi.</p>
        <Link className="btn btn-danger" to="/">Về trang chủ</Link>
      </section>
    </div>
  )
}

export default InfoPage
