# Giai đoạn 6A - Đặt vé và điểm đón/trả

Đã bổ sung:
- Public API GET /api/v1/public/trips/:tripId/service-points.
- Online, Hotline và Tại quầy lấy phương án đón/trả từ đúng cấu hình của chuyến.
- 3 phương án đón: Điểm chính / Điểm hẹn / Trung chuyển.
- 3 phương án trả: Điểm chính / Điểm dừng / Trung chuyển.
- Trung chuyển bắt buộc địa chỉ yêu cầu tối thiểu 5 ký tự, tối đa 500 ký tự.
- Backend tự resolve location/service mode và lưu snapshot vào Booking.
- Client không được tự gửi pickupLocationId/dropoffLocationId hoặc service mode.
- Online tiếp tục gửi email sau COMMIT.
- Hotline không tự gửi email; đánh dấu SMS mô phỏng và trả thông báo đúng nghiệp vụ MVC.
- Tại quầy không tự gửi email.
- Không có migration mới: dùng các cột đã tạo bởi migration MVC parity foundation.

Test mới:
- phase6.bookingServicePoints.test.js: 7 test.
- mvcParityPhase6Booking.test.js: 9 test.
- public.api.test.js được mở rộng endpoint service-points.

Nếu trước patch là 36 suite / 290 test, mục tiêu sau patch là khoảng 38 suite / 306 test, 0 failed.
