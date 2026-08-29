# Giai đoạn 8 - Quản trị tổng hợp

Đối chiếu với ASP.NET MVC và giữ kiến trúc React + Express + Prisma hiện tại.

## Đã bổ sung

- Dashboard loại khách đã lưu trữ khỏi tổng khách đang quản lý.
- Khách hàng:
  - phân loại VIP / Thường xuyên / Mới theo số vé thành công và tổng chi tiêu;
  - mức rủi ro theo Đã hủy + Không đi;
  - tuyến thường đi, lần đặt gần nhất, tổng chi tiêu;
  - lọc/sắp xếp theo phân loại, trạng thái, số vé, chi tiêu, lần đặt gần nhất;
  - ghi chú khách hàng;
  - xuất Excel `.xlsx`;
  - quy tắc xóa/lưu trữ 90 ngày như MVC: chưa có vé thì xóa thật, có lịch sử cũ thì lưu trữ, có vé tương lai/đang xử lý thì chặn.
- Tài khoản quản trị:
  - sửa họ tên/email/số điện thoại;
  - đặt lại mật khẩu (bcrypt);
  - đổi quyền ADMIN/STAFF bằng API quyền riêng;
  - khóa/mở tài khoản; không tự khóa hoặc tự đổi quyền đang đăng nhập.
- Nhật ký hệ thống:
  - tìm từ khóa;
  - lọc hành động/đối tượng;
  - lọc từ ngày/đến ngày;
  - phân trang.
- Tin tức:
  - giữ 3 trạng thái giao diện: Bản nháp / Đã đăng / Ẩn;
  - đếm lượt xem công khai khi mở bài đã đăng;
  - hiển thị lượt xem tại quản trị.

## CSDL

Migration mới `20260811000100_admin_parity` chỉ bổ sung:
- `CustomerStatus.ARCHIVED`
- `news.view_count`

Không reset database.

> Ghi chú bản hoàn thiện GĐ10: cùng migration này được mở rộng thêm `UserStatus.ARCHIVED` và `news.deleted_at` để hỗ trợ lưu trữ tài khoản và xóa mềm tin tức an toàn.
