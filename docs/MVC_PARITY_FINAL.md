# Nhà xe Thành Nhân - Đối chiếu MVC → Node.js hoàn tất

Bản Node.js giữ kiến trúc **React + Vite / Express / Prisma / Supabase PostgreSQL / JWT + bcrypt** và port các luồng nghiệp vụ từ dự án ASP.NET MVC tham chiếu. Những phần Node đã có sẵn được tái sử dụng thay vì viết lại.

## Phạm vi chức năng đã đồng bộ

### Khách hàng công khai
- Trang chủ, giới thiệu, liên hệ, tin tức.
- 7 trang thông tin/chính sách: Giới thiệu, Liên hệ, Quy chế hoạt động, Chính sách hủy vé, Bảo mật, Điều khoản, Hướng dẫn đặt vé.
- Tìm chuyến theo Tỉnh/Thành → bộ lọc khu vực → ngày → giờ/giá/loại xe/sắp xếp.
- Chỉ hiển thị chuyến đang mở bán, chưa khởi hành và thực sự phục vụ khu vực đã chọn.
- Xem chi tiết chuyến, sơ đồ ghế/phòng, giữ chỗ 10 phút.
- 34 giường và 22 phòng; phòng Limousine hỗ trợ Đơn/Đôi và backend tính lại giá.
- Chọn điểm đón/trả chính, điểm hẹn, điểm dừng hoặc trung chuyển tùy cấu hình chuyến.
- Đặt vé Online; tra cứu vé bằng mã vé + số điện thoại; hủy vé trước giờ khởi hành.
- PAY_AT_BUS giữ vé ở trạng thái chưa thanh toán cho tới khi nhân viên thu tiền.
- Gửi email vé theo cấu hình SMTP cho luồng phù hợp.

### Nhân viên / Chủ xe
- Đăng nhập quản trị, phân quyền ADMIN/STAFF và permission ở cả backend/frontend.
- Quản lý xe, tuyến, chuyến, địa điểm, bộ lọc địa điểm, điểm dừng tuyến và điểm phục vụ chuyến.
- Đặt vé Hotline và Tại quầy.
- Sơ đồ ghế, danh sách hành khách, chi tiết/in vé.
- Vé xe: tìm/lọc, sửa thông tin được phép, hủy + hoàn tiền, Không đi, xóa mềm, xác nhận Đã thu tiền, hoàn tác thu tiền theo quyền, xuất Excel.
- Hoàn thành chuyến sau giờ xuất phát; cảnh báo PAY_AT_BUS chưa thu và có thể xác nhận thu trước khi hoàn thành.
- Khách hàng: phân loại VIP/Thường xuyên/Mới, rủi ro vi phạm, ghi chú, khóa/mở, xuất Excel, xóa/lưu trữ an toàn.
- Tài khoản: tạo/sửa/đặt lại mật khẩu, đổi vai trò, khóa/mở, xóa hoặc lưu trữ an toàn; không tự xóa và không xóa Chủ xe hoạt động cuối cùng.
- Tin tức: nháp/đăng/ẩn, chọn ảnh từ máy JPG/JPEG/PNG/WEBP tối đa 5 MB hoặc URL, lượt xem, xóa mềm.
- Dashboard, doanh thu/thống kê và nhật ký hệ thống có lọc.

## Các quy tắc dữ liệu quan trọng
- `Đã hủy + Không đi >= 3` → chặn tạo vé ở Online, Hotline và Tại quầy.
- `Đã xóa` không tính là vi phạm.
- Vé `Không đi` giữ nguyên trạng thái thanh toán và không mở lại ghế sau khi xe đã xuất bến.
- Vé đã thanh toán khi hủy hợp lệ → `Đã hoàn tiền`; khoản hoàn không tính doanh thu.
- PAY_AT_BUS chỉ tính doanh thu sau khi đã thu tiền.
- Sau giờ khởi hành không cho sửa/hủy/ngừng bán chuyến; dùng `Không đi` cho hành khách không lên xe.
- Hoàn thành chuyến chỉ sau giờ khởi hành và có kiểm tra trạng thái thanh toán.
- Xóa vé là xóa mềm; lịch sử nghiệp vụ và audit không bị mất.
- Biển số chuẩn hóa để chống trùng và hiển thị dạng `XXY-XXX.XX`.

## Khác biệt có chủ đích so với MVC
- Node giữ **bcrypt + JWT** thay vì sao chép cách so mật khẩu trực tiếp của dự án MVC.
- Khi xóa khách hàng/tài khoản đã có lịch sử, Node ưu tiên **lưu trữ** để không phá khóa ngoại và audit; tài khoản/khách chưa có tham chiếu có thể xóa thật khi quy tắc cho phép.
- Ảnh tin tức chọn từ máy được lưu dưới dạng data URI trong trường ảnh hiện có thay vì ghi file trực tiếp vào `wwwroot`; URL ảnh cũ vẫn tương thích.
- Prisma migrations là nguồn schema chính. Không dùng `prisma migrate reset` trên dữ liệu thật.

## Migration cuối

`20260811000100_admin_parity` là migration bổ sung, không xóa dữ liệu:
- `CustomerStatus.ARCHIVED`
- `UserStatus.ARCHIVED`
- `news.view_count`
- `news.deleted_at`

Sau khi chép patch cuối, chạy `npm run db:generate` rồi `npm run db:migrate` ở backend.
