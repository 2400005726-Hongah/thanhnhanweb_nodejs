-- Đổi tên cột phút dự kiến cho đúng nghiệp vụ mới, không làm mất dữ liệu.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_service_points'
      AND column_name = 'legacy_estimated_minutes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_service_points'
      AND column_name = 'estimated_minutes'
  ) THEN
    ALTER TABLE "trip_service_points"
      RENAME COLUMN "legacy_estimated_minutes" TO "estimated_minutes";
  END IF;
END $$;

-- Cho phép cùng một địa điểm xuất hiện nhiều lần trong cùng chuyến nếu hình thức phục vụ khác nhau.
-- Migration nền cũ tạo khóa UNIQUE dưới dạng CONSTRAINT, vì vậy phải gỡ constraint trước index.
ALTER TABLE "trip_service_points"
  DROP CONSTRAINT IF EXISTS "trip_service_points_trip_location_type_key";
DROP INDEX IF EXISTS "trip_service_points_trip_location_type_key";
CREATE UNIQUE INDEX IF NOT EXISTS "trip_service_points_trip_location_type_mode_key"
  ON "trip_service_points" ("trip_id", "location_id", "point_type", "service_mode");
