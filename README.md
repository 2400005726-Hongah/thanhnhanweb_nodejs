# Hệ thống quản lý và đặt vé xe khách trực tuyến

**Tên website:** Nhà Xe Thành Nhân

## Mô tả dự án

Nhà Xe Thành Nhân là đồ án Node.js xây dựng hệ thống quản lý và đặt vé xe khách trực tuyến. Hệ thống dự kiến cho phép khách hàng tìm chuyến, chọn ghế, giữ ghế, đặt vé, tra cứu vé và quản lý lịch sử đặt vé. Khu vực quản trị sẽ hỗ trợ quản lý địa điểm, tuyến xe, xe, chuyến xe, ghế, đơn đặt vé, thanh toán, người dùng và thống kê.

Các API backend sẽ sử dụng tiền tố `/api/v1`.

## Công nghệ dự kiến

### Backend

- Node.js LTS
- Express.js
- JavaScript ES Modules
- Supabase PostgreSQL và Prisma ORM
- JWT, bcryptjs và express-validator
- Jest và Supertest

### Frontend

- React
- Vite
- Bootstrap
- React Router
- Axios

### Công cụ

- npm
- Git
- Supabase Table Editor

## Cấu trúc thư mục

```text
.
├── backend/       # Mã nguồn và cấu hình backend Node.js/Express
├── frontend/      # Ứng dụng React được khởi tạo bằng Vite
├── database/      # Tài liệu hoặc dữ liệu hỗ trợ database
├── docs/          # Tài liệu phân tích, thiết kế và API
├── .gitignore
└── README.md
```

## Cài đặt ban đầu

Yêu cầu máy đã cài Node.js LTS, npm và Git.

### Cài đặt backend

```bash
cd backend
npm install
```

Backend hiện có API từ Task 2 đến Task 10 và phân quyền ADMIN/STAFF tập trung. Sau khi cấu hình `backend/.env`, có thể chạy bằng `npm run dev`, kiểm thử bằng `npm test`, seed Chủ xe bằng `npm run seed:admin` và seed dữ liệu quản lý/chuyến tương lai bằng `npm run seed:data`.

Seed dữ liệu hiện tạo 6 địa điểm, 10 tuyến, 8 xe và 12 chuyến mỗi ngày trong 30 ngày kế tiếp. Có thể chạy lại `npm run seed:data` định kỳ để nối dài lịch mẫu; không cần nhập từng chuyến bằng tay.

### Cài đặt và chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Vite sẽ hiển thị URL truy cập cục bộ trong Terminal, thường là `http://localhost:5173`.

### Kiểm tra bản dựng frontend

```bash
cd frontend
npm run build
```

## Trạng thái hiện tại

Backend Task 4–10 chạy bằng Prisma trên Supabase PostgreSQL. Task 6 cung cấp tìm chuyến và sơ đồ ghế; Task 7 bổ sung giữ ghế và Booking; Task 8 bổ sung Payment `SIMULATED`; Task 9 bổ sung lịch sử vé, hủy booking và hoàn tiền mô phỏng. Task 10 có khu vực quản lý cho `ADMIN` (Chủ xe) và `STAFF` (Nhân viên quản trị), quản lý tin tức và nhật ký thao tác. Dự án chưa tích hợp cổng thanh toán thật.
