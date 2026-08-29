# Thao tác Vé xe – Nhà xe Thành Nhân

Patch này đồng bộ cột **Thao tác** của trang Vé xe với nghiệp vụ đã chốt.

## Nút và điều kiện

| Nút | Điều kiện hiển thị | API / xử lý |
|---|---|---|
| Xem | Luôn hiển thị | `/admin/ve-xe/:bookingCode` → `GET /admin/bookings/:bookingCode` |
| In | Luôn hiển thị | Dùng dữ liệu dòng vé hiện tại, chỉ `window.print()` |
| Sửa | `CONFIRMED` + chưa khởi hành | `/admin/ve-xe/:bookingCode?edit=1` → `PATCH /admin/bookings/:bookingCode/contact` |
| Đã thu tiền | `CONFIRMED` + `PAY_AT_BUS` + `PENDING` | `POST /admin/bookings/:bookingCode/collect-payment` |
| Hoàn tác thu tiền | Chỉ ADMIN + `CONFIRMED` + `PAY_AT_BUS` + `SUCCESS` | `POST /admin/bookings/:bookingCode/undo-payment` |
| Hủy vé | `CONFIRMED` + chưa khởi hành | `POST /admin/bookings/:bookingCode/cancel` |
| Khách không đi | `CONFIRMED` + đã tới/qua giờ khởi hành | `POST /admin/bookings/:bookingCode/no-show` |
| Xóa vé | `CONFIRMED` + chưa khởi hành + chưa thanh toán | `POST /admin/bookings/:bookingCode/delete` |

## Nghiệp vụ dữ liệu

- Hủy vé: mở lại ghế; nếu đã thanh toán thì chuyển thanh toán sang `REFUNDED`; tính vi phạm.
- Khách không đi: không mở lại ghế; không thay đổi thanh toán; tính vi phạm.
- Xóa vé: xóa mềm; mở lại ghế; không tính vi phạm; vé đã thanh toán bị backend chặn.
- Thu tiền: cập nhật Payment và Booking paymentStatus thành `SUCCESS`, ghi paidAt, amount và Audit Log.
- Hoàn tác thu tiền: chỉ ADMIN; Payment và Booking về `PENDING`, paidAt = null, giữ amount, ghi Audit Log.
- Sửa vé: chỉ thay Họ tên, SĐT, Ghi chú nhân viên. Backend cũng bắt buộc vé `CONFIRMED` và chưa khởi hành.

## Giao diện

- Nút Sửa được bổ sung trực tiếp ở cột Thao tác.
- Bấm Sửa mở trang Chi tiết vé với form sửa được mở sẵn.
- Thu tiền dùng modal riêng có Mã vé, Mã giao dịch, Khách, Ghế/Phòng, Phương thức, Số tiền và checkbox xác nhận đã nhận đủ tiền.
- Hủy/Xóa/Không đi/Hoàn tác dùng modal nhập lý do 5–500 ký tự.
- Sau mọi thao tác thành công, danh sách được gọi lại API để cập nhật đúng trạng thái, ghế và thanh toán.
