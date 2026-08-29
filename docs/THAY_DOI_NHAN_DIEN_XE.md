# Nhận diện xe mới

Xe không còn có **Tên xe** do người dùng nhập.

Nguồn nhận diện chính:

- `licensePlate`: biển số duy nhất.
- `busType`: loại xe chuẩn.
- `capacity`: backend suy ra từ loại xe.

Trường `busName` vẫn tồn tại trong database để không phá dữ liệu/API legacy. Khi tạo xe mới hoặc đổi biển số, backend tự đồng bộ trường này bằng `Loại xe - Biển số`; frontend không gửi `busName` nữa.

Không cần migration Prisma.
