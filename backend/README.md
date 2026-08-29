# Backend Nhà Xe Thành Nhân

Backend Node.js/Express ES Modules cho hệ thống quản lý và đặt vé Nhà Xe Thành Nhân.

## Công nghệ

- Node.js và Express.js
- Supabase PostgreSQL
- Prisma ORM 7 và `@prisma/adapter-pg`
- JWT, bcryptjs và express-validator
- Jest và Supertest

Frontend chỉ gọi REST API `/api/v1`; frontend không kết nối trực tiếp Supabase và dự án không dùng Supabase Auth.

## Cấu hình

Sao chép `.env.example` thành `.env`, sau đó cấu hình `DATABASE_URL` bằng Session Pooler connection string của Supabase. Không ghi URL thật hoặc bí mật vào source code.

`SEAT_HOLD_MINUTES` cấu hình thời gian giữ ghế, mặc định 10 phút và chỉ nhận giá trị từ 1 đến 30.

`BOOKING_CANCEL_BEFORE_MINUTES` cấu hình số phút tối thiểu phải còn trước giờ khởi hành để được hủy vé, mặc định 120 phút.

```bash
npm install
npm run db:format
npm run db:validate
npm run db:generate
npm run db:baseline
npm run db:seed
npm run dev
npm test
```

Trước `db:baseline`, hãy chạy thành công `database/supabase_schema.sql` trong Supabase SQL Editor. `db:baseline` chỉ chạy một lần để ghi nhận schema ban đầu. Các migration phát sinh sau này mới triển khai bằng `npm run db:migrate`; không dùng `db:migrate:dev` trên production.

Prisma 7 chỉ chạy seed khi gọi rõ `prisma db seed`; server không tự động seed. Seed SQL và seed Node đã dùng cùng mã ghế và có thể chạy lại mà không tạo bản ghi trùng.

`npm run seed:data` không còn ghi dữ liệu demo tuyến/chuyến kiểu cũ. Hãy tạo dữ liệu vận hành từ giao diện quản trị theo kiến trúc Tỉnh/Thành → Bộ lọc → Địa điểm cụ thể → Chuyến xe.

## API

```http
GET /api/v1/health
POST /api/v1/auth/register
POST /api/v1/auth/login
GET /api/v1/auth/me
PATCH /api/v1/auth/change-password

GET|POST|PATCH|DELETE /api/v1/locations
GET|POST|PATCH|DELETE /api/v1/routes
GET|POST|PATCH|DELETE /api/v1/buses
GET|POST|PATCH|DELETE /api/v1/buses/:busId/seats
GET|POST|PATCH|DELETE /api/v1/trips
PATCH /api/v1/trips/:id/status

GET /api/v1/public/locations
GET /api/v1/public/trips/search
GET /api/v1/public/trips/:tripId
GET /api/v1/public/trips/:tripId/seats
POST /api/v1/public/trips/:tripId/seats/hold
DELETE /api/v1/public/trips/:tripId/seats/hold
POST /api/v1/public/bookings
GET /api/v1/public/bookings/lookup
POST /api/v1/public/bookings/:bookingCode/payments/simulate
POST /api/v1/public/bookings/:bookingCode/cancel

GET /api/v1/bookings/me
POST /api/v1/bookings/:bookingCode/cancel

GET /api/v1/admin/dashboard/summary
GET /api/v1/admin/bookings
GET /api/v1/admin/bookings/:bookingCode
PATCH /api/v1/admin/bookings/:bookingCode/contact
POST /api/v1/admin/bookings/:bookingCode/cancel
POST /api/v1/admin/bookings/:bookingCode/no-show
GET|PATCH /api/v1/admin/customers
GET|POST|PATCH /api/v1/admin/users
GET /api/v1/admin/revenue/summary
GET /api/v1/admin/audit-logs
GET|POST|PATCH|DELETE /api/v1/admin/news
```

Phân quyền quản trị dùng permission map tập trung. `ADMIN` hiển thị là **Chủ xe** và có toàn quyền. `STAFF` hiển thị là **Nhân viên quản trị**: được xem/sửa chuyến và tuyến, quản lý vé/khách hàng/tin tức, xem xe; không được tạo/xóa chuyến hoặc tuyến, quản lý xe, xem doanh thu, quản lý tài khoản hay xem nhật ký. Backend trả `403` cho thao tác bị cấm, không chỉ ẩn nút ở frontend.

Giữ ghế và tạo booking hỗ trợ khách chưa đăng nhập. Nếu request tạo booking có JWT hợp lệ, backend tự gắn `userId`; tổng tiền, mã booking và trạng thái luôn do backend quyết định. Ghế được khóa theo thứ tự bằng PostgreSQL `SELECT ... FOR UPDATE` bên trong Prisma transaction để ngăn giữ hoặc đặt trùng.

Thanh toán Task 8 chỉ dùng phương thức `SIMULATED`, không kết nối cổng thanh toán thật. Backend khóa Booking bằng PostgreSQL trước khi tạo Payment, lấy số tiền trực tiếp từ Booking và cập nhật đồng thời Booking thành `CONFIRMED`/`SUCCESS`. Tra cứu công khai yêu cầu đúng bookingCode và số điện thoại, chỉ trả DTO công khai không chứa ID nội bộ.

Task 9 cho phép Customer xem lịch sử booking của chính mình và cho Customer/Guest hủy vé đủ điều kiện. Transaction hủy khóa Booking, TripSeat và Payment theo thứ tự cố định; ghế được giải phóng, BookingItem được giữ làm lịch sử và Payment `SUCCESS` được chuyển thành `REFUNDED`.

Task 10 bổ sung `STAFF`, News, AuditLog, đánh dấu khách `NO_SHOW`, dashboard vận hành và các API quản trị. Tin tức được lọc HTML nguy hiểm trước khi lưu và chỉ xóa mềm. Hai bảng News/AuditLog bật RLS, không cấp quyền Data API cho `anon` hoặc `authenticated`; frontend tiếp tục chỉ gọi Express API.

## Database

Schema nằm tại `prisma/schema.prisma`. Các bảng dùng UUID và tiền tệ dùng PostgreSQL `Decimal`. Tạo Trip cùng TripSeat, thay xe cho Trip, giữ ghế và tạo Booking/BookingItem được thực hiện bằng `prisma.$transaction`.

Schema Supabase chuẩn nằm trong `database/supabase_schema.sql`. Chỉ cấu hình hoặc áp dụng migration sau khi `DATABASE_URL` hợp lệ. Backend hiện dùng Prisma; model và dependency Mongoose cũ đã được loại bỏ.
