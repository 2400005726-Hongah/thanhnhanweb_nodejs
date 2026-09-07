CREATE TABLE IF NOT EXISTS "bus_type_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bus_type" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bus_type_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bus_type_images_storage_path_key" UNIQUE ("storage_path"),
  CONSTRAINT "bus_type_images_bus_type_check"
    CHECK ("bus_type" IN ('SLEEPER_34', 'LIMOUSINE_22'))
);

CREATE INDEX IF NOT EXISTS "bus_type_images_type_active_sort_idx"
ON "bus_type_images"("bus_type", "is_active", "sort_order");
