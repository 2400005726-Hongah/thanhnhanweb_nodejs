-- Chạy file này để kiểm tra bảng thư viện ảnh đã tồn tại.
SELECT
  id,
  bus_type,
  image_url,
  storage_path,
  sort_order,
  is_active,
  created_at
FROM public.bus_type_images
ORDER BY bus_type, sort_order, created_at;

-- Kiểm tra bucket ảnh.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'bus-type-images';
