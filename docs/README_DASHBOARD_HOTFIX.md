# HOTFIX Dashboard trắng

Sửa `frontend/src/pages/admin/AdminDashboardPage.jsx`:

- Import `formatBookingCode` đang bị thiếu, nguyên nhân gây `ReferenceError` khi có `recentBookings`.
- Chuyển hiển thị hành trình chuyến sắp đi sang fallback an toàn `trip.routeName || trip.route?.routeName`.
- Hiển thị thông tin xe bằng optional chaining để dữ liệu thiếu không làm sập toàn trang.

Không sửa backend, database hoặc migration.
