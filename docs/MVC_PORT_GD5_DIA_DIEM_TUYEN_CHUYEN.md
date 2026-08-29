# Giai đoạn 5 - Địa điểm, Tuyến đường và Chuyến xe

## Đã bổ sung

### Quản lý địa điểm nhiều tầng
- Tỉnh/Thành.
- Khu vực/Bộ lọc địa điểm.
- Địa điểm cụ thể.
- Một địa điểm có thể thuộc nhiều bộ lọc.
- Loại địa điểm: chỉ đón, chỉ trả hoặc cả hai.
- STAFF dùng quyền `EDIT_ROUTES` để quản lý danh mục, không cần quyền quản lý tài khoản.
- Bổ sung ràng buộc chống ngừng/đổi tỉnh khi dữ liệu đang được tuyến, chuyến hoặc vé sử dụng.

### Cấu hình điểm dừng tuyến
- API `GET /api/v1/routes/:id/stops`.
- API `PUT /api/v1/routes/:id/stops`.
- Chỉ khu vực thuộc tỉnh/thành điểm đi được chọn làm khu vực đón.
- Chỉ khu vực thuộc tỉnh/thành điểm đến được chọn làm khu vực trả.
- Có Audit Log `CONFIGURE_ROUTE_STOPS`.
- Có giao diện `/admin/tuyen-duong/:routeId/diem-dung`.

### Cấu hình điểm phục vụ chuyến
- Giao diện `/admin/chuyen-xe/:tripId/diem-don-tra`.
- Hình thức đón chính: bến xe hoặc văn phòng.
- Hình thức trả chính: bến xe hoặc văn phòng.
- Tùy chọn trung chuyển đón, điểm hẹn đón, trung chuyển trả, điểm dừng trả.
- Điểm đi và điểm đến chính được backend tự đồng bộ thành điểm phục vụ mặc định thứ tự 1.
- Điểm phụ chỉ được giữ khi hình thức tương ứng được bật.
- Sau giờ khởi hành hoặc khi chuyến kết thúc, backend và frontend đều khóa chỉnh sửa.

### Trang Chuyến xe & Tuyến đường
- Form chuyến có cấu hình hình thức đón/trả cơ bản.
- Có cột riêng `Điểm đón/trả`.
- Vẫn giữ riêng `Sơ đồ ghế` và `Thao tác`.
- Tuyến có nút `Điểm dừng` để cấu hình khu vực phục vụ.

## Test mới
- `tests/mvcParityPhase5Frontend.test.js`: 6 test.
- `tests/routeStop.services.test.js`: 3 test.

Nếu trạng thái trước patch là `34 suites / 281 tests`, mục tiêu sau patch là khoảng:

- `36 suites passed`
- `290 tests passed`
- `0 failed`

## Cách cài
Giải nén ZIP tại thư mục gốc dự án và chọn ghi đè file.

Không chạy reset database. Giai đoạn này không tạo migration mới vì dùng các bảng/cột đã được tạo ở migration `20260810000100_mvc_parity_foundation`.

## Lệnh kiểm tra

Backend:

```powershell
cd "D:\Đồ án NODE  JS\backend"
npm run db:validate
npm run db:generate
npm test
```

Frontend:

```powershell
cd "D:\Đồ án NODE  JS\frontend"
npm run build
npm run lint
```

Sau đó chạy backend/frontend và kiểm tra thủ công:

1. ADMIN và STAFF đều thấy menu `Địa điểm`.
2. Thêm/sửa Tỉnh/Thành.
3. Thêm/sửa Khu vực/Bộ lọc.
4. Thêm/sửa Địa điểm cụ thể và chọn nhiều bộ lọc.
5. Vào Chuyến xe & Tuyến đường → tuyến → `Điểm dừng`.
6. Chọn khu vực đón đúng tỉnh đi và khu vực trả đúng tỉnh đến.
7. Vào chuyến → `Cấu hình điểm`.
8. Bật điểm hẹn/trung chuyển/điểm dừng và thêm điểm phụ.
9. Lưu, tải lại trang và xác nhận dữ liệu giữ nguyên.
10. Với chuyến đã qua giờ khởi hành, trang điểm đón/trả phải bị khóa.
