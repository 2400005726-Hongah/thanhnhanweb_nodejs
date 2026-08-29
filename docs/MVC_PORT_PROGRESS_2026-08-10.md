# Tiến độ port ThanhNhanWeb MVC sang dự án Node.js hiện tại

## Chiến lược rút gọn

Không tạo lại Node.js từ đầu và không chuyển sang EJS. Dự án hiện tại đã có Express + React/Vite + Prisma + Supabase, nên giữ nguyên kiến trúc này để tái sử dụng booking, ghế, thanh toán, phân quyền, audit và test hiện có.

## Giai đoạn 1 – Phân tích MVC

Hoàn thành.

## Giai đoạn 2 – Thiết kế port

Hoàn thành và đã điều chỉnh: giữ React/Vite thay vì EJS để rút ngắn tiến độ.

## Giai đoạn 3 – Nền tảng CSDL tương thích MVC

Hoàn thành ở mức source/migration.

Đã bổ sung:
- Province ↔ TinhThanh.
- PickupDropoffArea ↔ DiaDiemDonTra.
- Location mở rộng ↔ DiaDiemCuThe.
- LocationAreaFilter ↔ DiaDiemCuTheBoLoc.
- RouteStop ↔ TuyenDiemDung.
- TripServicePoint ↔ ChuyenDiemPhucVu.
- Trip: địa điểm cụ thể, hình thức đón/trả chính, cờ trung chuyển/điểm hẹn/điểm dừng, trạng thái bán, trạng thái vận hành, completedAt.
- Booking: điểm đón/trả FK + snapshot hình thức/kiểu/địa chỉ yêu cầu + trạng thái SMS.
- User: username tùy chọn để mở đường tương thích tài khoản MVC.
- Customer: note.
- Route: description.

Migration mới:
`20260810000100_mvc_parity_foundation`

Migration chỉ ADD/BACKFILL, không DROP bảng/cột.

## Giai đoạn 4 – Backend core

Được rút gọn vì dự án Node đã có sẵn:
- Express app/server.
- Prisma/Supabase.
- JWT.
- bcrypt.
- permission middleware.
- validation.
- error middleware.
- audit log.
- transaction.
- normalization.

Không viết lại.

## Giai đoạn 5 – Danh mục vận hành (backend)

Đã triển khai phần backend nền:
- API catalog tỉnh/khu vực/địa điểm cụ thể.
- ADMIN và STAFF có `EDIT_ROUTES` được quản lý danh mục giống `[Authorize]` MVC.
- API cấu hình điểm phục vụ chuyến.
- Hình thức phục vụ giữ đúng mã MVC.
- Trip create/update/status đồng bộ các trường trạng thái bán/vận hành mới.
- Hoàn thành chuyến ghi `completedAt`.

Còn trong Giai đoạn 5:
- Frontend trang quản lý địa điểm nhiều tầng.
- Frontend cấu hình điểm phục vụ chuyến.
- RouteStop UI nếu cần giữ màn hình cấu hình tuyến cũ.

## Kiểm tra đã chạy trong môi trường hiện tại

- `node --check` toàn bộ backend/src và backend/tests: PASS.
- Kiểm tra relative imports: 0 file thiếu.
- Kiểm tra cấu trúc schema cơ bản: PASS, 18 Prisma models.
- Jest không chạy được trong container do node_modules ZIP từ Windows thiếu `jest-circus/build/runner.js` trên môi trường Linux. Cần chạy `npm test` trên Windows sau khi `npm ci`/dùng node_modules đúng máy.
- `prisma validate` không chạy được trong container vì Prisma cố tải Linux schema-engine nhưng môi trường không có internet. Cần chạy trên máy Windows.

## Lệnh bắt buộc trên máy người dùng sau khi chép patch

```powershell
cd "D:\Đồ án NODE  JS\backend"
npm run db:validate
npm run db:generate
npm run db:migrate
npm test
```

Không dùng `prisma migrate reset`.

## Hotfix Prisma 2026-08-10
- Đã sửa 6 trường Prisma dùng nhầm kiểu `Bool` thành `Boolean`.
- Các trường: `allowPickupTransfer`, `allowPickupMeetingPoint`, `allowDropoffTransfer`, `allowDropoffStop`, `TripServicePoint.isDefault`, `Booking.smsSent`.
- Đã kiểm tra tĩnh toàn schema: 18 models, 13 enums, không còn kiểu field không xác định.
- Đã kiểm tra toàn bộ JavaScript backend bằng `node --check`: đạt.
- Đã kiểm tra đường dẫn relative import backend/tests: không thiếu file.
- `prisma validate` runtime vẫn cần chạy trên máy Windows của dự án vì môi trường kiểm tra Linux không tải được Prisma schema engine.
