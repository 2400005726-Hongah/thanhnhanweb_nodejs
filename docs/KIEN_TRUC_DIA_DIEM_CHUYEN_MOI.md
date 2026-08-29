# Kiến trúc địa điểm và chuyến xe mới - Nhà xe Thành Nhân

## 1. Nguồn dữ liệu gốc

`Province` (Tỉnh/Thành) là danh mục gốc. Mọi bộ lọc và địa điểm cụ thể đều tham chiếu về tỉnh/thành này.

```text
Province
  ├── PickupDropoffArea
  └── Location
```

Chỉ tỉnh/thành `ACTIVE` mới được dùng trong form tạo chuyến và tìm chuyến công khai.

## 2. Bộ lọc địa điểm

`PickupDropoffArea` có ý nghĩa là danh mục bộ lọc cho khách hàng, ví dụ Buôn Hồ, Krông Năng, Quận 12.

Mỗi bộ lọc thuộc đúng một tỉnh/thành và có:
- Tên bộ lọc.
- Thứ tự hiển thị.
- Trạng thái.

Bộ lọc không quyết định chuyến một cách độc lập. Chuyến được lọc thông qua bộ lọc chính đã gắn vào địa điểm cụ thể.

## 3. Địa điểm cụ thể

`Location` là địa điểm thật được chọn khi tạo chuyến, ví dụ Văn phòng Buôn Hồ hoặc Bến xe An Sương.

Nghiệp vụ mới bắt buộc khi tạo/cập nhật qua API `/locations/specific`:
- Một `provinceId`.
- Một `defaultAreaId` thuộc cùng tỉnh/thành.
- Một `locationType`: `PICKUP`, `DROPOFF` hoặc `BOTH`.
- Tên chuẩn hóa chống trùng trong cùng tỉnh/thành.

`LocationAreaFilter` vẫn được giữ trong schema/database để bảo toàn dữ liệu legacy nhưng không còn được dùng bởi nghiệp vụ mới. `defaultAreaId` là bộ lọc chính thức duy nhất.

## 4. Chuyến xe tham chiếu trực tiếp địa điểm cụ thể

`Trip.departureLocationId` và `Trip.arrivalLocationId` là nguồn chính xác định hành trình.

Khi tạo chuyến:
- Điểm đi phải thuộc tỉnh đi và có loại `PICKUP` hoặc `BOTH`.
- Điểm đến phải thuộc tỉnh đến và có loại `DROPOFF` hoặc `BOTH`.
- Hai tỉnh/thành phải khác nhau.
- Hai địa điểm cụ thể phải khác nhau.
- Xe, thời gian và giá vẫn được kiểm tra tại backend.

`Trip.routeId` được chuyển thành nullable. Route cũ chỉ được giữ để đọc dữ liệu legacy; chuyến mới không cần Route.

## 5. Tìm chuyến Online

Khách tìm theo:

```text
Tỉnh/Thành đi → Tỉnh/Thành đến → Ngày đi
```

Backend lọc theo quan hệ trực tiếp:

```text
Trip.departureLocation.provinceId
Trip.arrivalLocation.provinceId
```

Nếu khách chọn nhiều bộ lọc, backend lọc bằng:

```text
Trip.departureLocation.defaultAreaId IN (...)
Trip.arrivalLocation.defaultAreaId IN (...)
```

Không còn dùng `LocationAreaFilter` để tìm chuyến.

## 6. Tuyến xe là trang tổng hợp

Trang Tuyến xe không còn tạo/sửa/xóa tuyến để phục vụ tạo chuyến. Giao diện đọc dữ liệu từ các chuyến thực tế và nhóm theo:

```text
departureLocationId + arrivalLocationId
```

Mỗi dòng hiển thị cặp địa điểm cụ thể và số chuyến tương ứng.

Các model/bảng `Route`, `RouteStop`, `TripServicePoint` được giữ để bảo toàn lịch sử và tương thích dữ liệu cũ. Các màn hình cấu hình điểm dừng cũ đã được gỡ khỏi router frontend.

## 7. Migration an toàn

Migration của kiến trúc này chỉ làm `trips.route_id` nullable:

```sql
ALTER TABLE "trips" ALTER COLUMN "route_id" DROP NOT NULL;
```

Không DROP bảng, cột hoặc dữ liệu.

Không chạy `prisma migrate reset`.

## 8. Thứ tự nhập dữ liệu mới

Sau khi làm sạch dữ liệu test, tạo lại theo thứ tự:

```text
Tỉnh/Thành
→ Bộ lọc địa điểm
→ Địa điểm cụ thể
→ Xe (nếu chưa có)
→ Chuyến xe
→ Tìm chuyến / Đặt vé
```

Không cần tạo Tuyến xe trước Chuyến xe. Trang Tuyến xe sẽ tự xuất hiện dữ liệu sau khi có Chuyến xe.

`npm run seed:data` chỉ hiển thị hướng dẫn và không chèn lại dữ liệu demo legacy.
