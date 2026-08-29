ALTER TABLE "pickup_dropoff_areas"
ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "locations"
ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT FALSE;

DROP INDEX IF EXISTS "pickup_dropoff_areas_province_status_sort_idx";
CREATE INDEX IF NOT EXISTS "pickup_dropoff_areas_province_deleted_status_sort_idx"
ON "pickup_dropoff_areas"("province_id", "is_deleted", "status", "sort_order");

DROP INDEX IF EXISTS "locations_province_status_sort_idx";
CREATE INDEX IF NOT EXISTS "locations_province_deleted_status_sort_idx"
ON "locations"("province_id", "is_deleted", "status", "sort_order");
