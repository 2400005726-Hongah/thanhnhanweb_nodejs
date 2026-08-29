# Giao diện khách hàng Nhà xe Thành Nhân

Frontend React/Vite dùng Bootstrap, React Router và Axios. Task 6–9 hoàn thiện luồng khách hàng. Task 10 bổ sung khu vực quản lý riêng cho Chủ xe (`ADMIN`) và Nhân viên quản trị (`STAFF`).

## Cấu hình

Sao chép `.env.example` thành `.env` khi cần đổi địa chỉ API:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Không đưa `DATABASE_URL`, JWT secret hoặc Supabase secret vào frontend.

## Chạy dự án

```powershell
npm install
npm run dev
npm run lint
npm run build
```

Mở `http://localhost:5173`, tìm chuyến, chọn tối đa 6 ghế và nhấn **Tiếp tục đặt vé**. Hệ thống giữ ghế trong 10 phút, chuyển tới `/dat-ve/:tripId`, sau đó hiển thị booking tại `/dat-ve-thanh-cong/:bookingCode`. Nút thanh toán chỉ mô phỏng và không thu tiền thật. Route `/tra-cuu-ve` kiểm tra booking bằng mã đặt vé và số điện thoại.

Đăng ký tại `/dang-ky`, đăng nhập tại `/dang-nhap`; JWT chỉ được lưu trong `sessionStorage`. Customer xem và hủy vé của mình tại route được bảo vệ `/ve-cua-toi`. Guest có thể tra cứu và hủy booking đủ điều kiện tại `/tra-cuu-ve`.

Tài khoản `ADMIN` hoặc `STAFF` đăng nhập sẽ được chuyển tới `/admin`. Trang `/admin/chuyen-xe` quản lý chuyến trực tiếp theo địa điểm cụ thể; `/admin/tuyen-xe` chỉ tổng hợp các tuyến đang có từ dữ liệu chuyến. STAFF thấy nút Sửa nhưng không thấy nút Thêm/Xóa; đồng thời không có menu Thống kê, Tài khoản và Nhật ký hệ thống. Route `/admin/tin-tuc` dành cho cả ADMIN và STAFF.
