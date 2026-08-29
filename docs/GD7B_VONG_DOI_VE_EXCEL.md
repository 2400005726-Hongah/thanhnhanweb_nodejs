# Giai đoạn 7B - Vòng đời vé và xuất Excel

Đã đồng bộ gần MVC:
- Hủy vé: chỉ vé Đã đặt, được hủy đến trước giờ khởi hành; sau giờ yêu cầu dùng Không đi.
- Vé đã thanh toán khi hủy: Payment -> REFUNDED, Booking -> CANCELLED, giải phóng ghế.
- Không đi: chỉ sau giờ khởi hành, giữ nguyên payment status và giữ ghế không mở bán lại.
- Xóa mềm: giữ logic GĐ7A - chỉ vé Đã đặt, chưa thanh toán, trước giờ khởi hành.
- Sửa vé: chỉ Họ tên, SĐT, Ghi chú nhân viên; khóa với vé hủy/không đi/xóa/hoàn thành hoặc sau giờ khởi hành.
- Danh sách vé: bổ sung lọc theo Ngày xuất bến.
- Xuất Excel: thêm API GET /api/v1/admin/bookings/export.xlsx, xuất toàn bộ kết quả theo bộ lọc hiện tại thành XLSX thật (không dùng thêm package ngoài).
- In vé hiện có được giữ nguyên.

Không có migration mới.
