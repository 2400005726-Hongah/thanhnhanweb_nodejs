-- 1) Tạo bảng thư viện ảnh theo LOẠI XE, không gắn theo biển số.
CREATE TABLE IF NOT EXISTS public.bus_type_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_type text NOT NULL CHECK (bus_type IN ('SLEEPER_34', 'LIMOUSINE_22')),
  image_url text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bus_type_images_type_active_sort_idx
ON public.bus_type_images(bus_type, is_active, sort_order);

-- 2) Bucket ảnh công khai. Backend upload bằng SUPABASE_SECRET_KEY.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bus-type-images',
  'bus-type-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
