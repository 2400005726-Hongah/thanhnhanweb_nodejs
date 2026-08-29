# Hotfix input không nhảy số

Sửa tại `frontend/src/utils/normalizers.js`.

- SĐT: khi đang nhập dưới 10 số sẽ không tự chèn khoảng trắng. Khi đủ 10 số mới hiển thị dạng `0912 345 678`.
- Biển số: khi đang nhập dưới 8 ký tự chuẩn sẽ không tự chèn `-` hoặc `.`. Khi đủ 8 ký tự mới hiển thị dạng `47B-123.45`.
- Backend/normalize trước khi submit không thay đổi.
- Không migration, không sửa database.
