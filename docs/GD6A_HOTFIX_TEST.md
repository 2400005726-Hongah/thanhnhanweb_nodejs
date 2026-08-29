HOTFIX Giai đoạn 6A - chỉ sửa test parity, không sửa nghiệp vụ.

Nguyên nhân:
1. Các mã DiemChinh / DiemHen / DiemDung / TrungChuyen và service mode đã được tách đúng sang servicePointCatalog.js, nhưng test cũ lại tìm trực tiếp trong bookingServicePoint.service.js.
2. Backend tạo thông báo trung chuyển bằng template `Vui lòng nhập địa chỉ ${label} cụ thể cho xe trung chuyển`, nên source không chứa nguyên câu cố định "Vui lòng nhập địa chỉ đón cụ thể" / "... trả cụ thể" dù runtime vẫn sinh đúng câu. Suite phase6.bookingServicePoints.test.js đã xác nhận hành vi runtime này.

Hotfix chỉ cập nhật backend/tests/mvcParityPhase6Booking.test.js để kiểm tra đúng cấu trúc code hiện tại.
