# Giai đoạn 6B - Tìm chuyến theo Tỉnh/Thành và Bộ lọc địa điểm

## Đã bổ sung
- Public API `GET /api/v1/public/search/catalog` trả tỉnh/thành đang hoạt động và bộ lọc khu vực đang hoạt động.
- Form tìm chuyến chuyển sang `Tỉnh/Thành đi -> Tỉnh/Thành đến -> Ngày khởi hành` như MVC.
- Tỉnh/Thành đến tự loại Tỉnh/Thành đi.
- Trang kết quả có bộ lọc nhiều lựa chọn cho khu vực điểm đi và khu vực điểm đến.
- Backend tìm chuyến bằng `Trip.departureLocation` / `Trip.arrivalLocation` và hỗ trợ fallback Route cho dữ liệu cũ.
- Bộ lọc khu vực khớp nếu địa điểm cụ thể có `defaultAreaId` phù hợp hoặc có quan hệ `LocationAreaFilter` phù hợp.
- Chỉ trả chuyến Mở bán + Chưa khởi hành + xe hoạt động + tuyến hoạt động + thời gian tương lai.
- Giữ giá từ/đến, giờ từ/đến, loại xe, sắp xếp và phân trang.
- Giữ tương thích API tìm theo exact location cũ (`departureLocationId`, `arrivalLocationId`).
- Kết quả hiển thị địa điểm cụ thể của chuyến nếu có, fallback địa điểm tuyến cho dữ liệu legacy.

## Không cần migration
Giai đoạn này dùng schema của GĐ3/GĐ5 hiện có.

## Kiểm tra đề nghị
Backend:
```
npm test
```
Mục tiêu dự kiến từ mốc 38 suites / 306 tests:
- 40 suites PASS
- khoảng 319 tests PASS
- 0 failed

Frontend:
```
npm run build
```

## Test thủ công
1. Chọn Đắk Lắk -> TP.HCM -> ngày đi.
2. Xác nhận chỉ tỉnh hoạt động xuất hiện và tỉnh đến không chứa tỉnh đi.
3. Tick một/nhiều bộ lọc điểm đi, ví dụ Ea Tân/Krông Năng.
4. Tick một/nhiều bộ lọc điểm đến, ví dụ Quận 12/Tân Bình.
5. Chuyến chỉ còn nếu địa điểm cụ thể của chuyến thuộc ít nhất một bộ lọc đã chọn ở mỗi đầu.
6. Bỏ tick để kết quả mở rộng lại.
7. Test Giá từ/đến, Giờ từ/đến, Loại xe, Sắp xếp.
