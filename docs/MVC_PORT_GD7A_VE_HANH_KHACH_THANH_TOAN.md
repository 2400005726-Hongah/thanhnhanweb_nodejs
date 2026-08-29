# Giai đoạn 7A - Vé xe, hành khách và xác nhận thu tiền

Đã bổ sung/đồng bộ theo bản ASP.NET MVC:

- API xác nhận đã thu tiền cho vé Thanh toán khi lên xe.
- Chỉ vé Đã đặt + PAY_AT_BUS + Chưa thanh toán mới được xác nhận.
- Nhân viên quản trị và Chủ xe đều có thể xác nhận đã thu tiền.
- Chỉ Chủ xe được hoàn tác xác nhận thu tiền, bắt buộc lý do 5-500 ký tự.
- Ghi Audit Log khi xác nhận/hoàn tác.
- Trang Vé xe, Chi tiết vé và Danh sách hành khách có nút Đã thu tiền.
- Chủ xe có nút Hoàn tác thu tiền.
- Xóa vé được siết giống MVC: chỉ vé Đã đặt, chưa thanh toán, trước giờ khởi hành; vé đã thanh toán phải dùng Hủy vé để hoàn tiền.
- Giữ nguyên Không đi: chỉ sau giờ khởi hành, không thay đổi trạng thái thanh toán và không mở lại ghế để bán.

Không có migration mới.
