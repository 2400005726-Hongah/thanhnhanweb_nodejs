-- Bổ sung điểm đón/trả chi tiết cho vé.
-- Migration chỉ thêm cột, không xóa hoặc sửa dữ liệu hiện có.

alter table public.bookings
  add column if not exists pickup_point text,
  add column if not exists dropoff_point text;
