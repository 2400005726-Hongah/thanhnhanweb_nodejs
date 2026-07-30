# Cơ sở dữ liệu Supabase PostgreSQL

Bộ SQL này dành cho project Supabase mới và cần được chạy theo đúng thứ tự bên dưới.

## Thứ tự chạy trong Supabase

1. Mở Supabase Dashboard và chọn project.
2. Mở **SQL Editor** → **New query**.
3. Sao chép toàn bộ nội dung `supabase_schema.sql`, dán vào query và bấm **Run**.
4. Xác nhận không có lỗi, rồi mở **Table Editor** để kiểm tra 10 bảng.
5. Tạo query mới, chạy toàn bộ `supabase_seed.sql`.
6. Tạo query mới, chạy toàn bộ `supabase_verify.sql` và kiểm tra kết quả.

Schema bật RLS nhưng không tạo policy public. Frontend không truy cập database trực tiếp; backend Node.js truy cập bằng Prisma.

## Lấy DATABASE_URL

Trong Supabase Dashboard, mở **Connect** (hoặc **Project Settings → Database**) và chọn **Session Pooler**, cổng **5432**. Sao chép connection string PostgreSQL, thay placeholder mật khẩu bằng database password của project, rồi đặt vào `backend/.env`:

```env
DATABASE_URL="postgresql://...:5432/postgres"
```

Không dùng `SUPABASE_SECRET_KEY` làm `DATABASE_URL`, không đưa database password hoặc secret vào frontend/source control.

## Chuẩn bị Prisma và chạy backend

```powershell
cd backend
npm install
npx prisma generate
npx prisma validate
npm run db:baseline
npm start
```

`db:baseline` chỉ chạy một lần sau khi bạn đã chạy thành công `supabase_schema.sql`. Lệnh này ghi nhận schema ban đầu trong lịch sử Prisma mà không tạo lại hay xóa dữ liệu. Các lần triển khai migration về sau dùng `npm run db:migrate`.

Kiểm tra API: `GET http://localhost:5000/api/v1/health` (hoặc PORT đã cấu hình). Admin không được seed bằng SQL vì mật khẩu phải được hash bằng bcryptjs; hãy dùng job Node.js riêng sau khi kết nối thành công.

Lưu ý: transaction PostgreSQL hoạt động qua Supabase. Backend không còn dùng MongoDB/Mongoose. Không chạy `db:migrate:dev` trực tiếp trên database production.
