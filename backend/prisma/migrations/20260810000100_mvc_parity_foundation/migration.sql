-- Nền tảng tương thích nghiệp vụ từ ThanhNhanWeb ASP.NET MVC.
-- Chỉ bổ sung dữ liệu/bảng/cột. Không xóa bảng và không làm mất lịch sử hiện có.
-- Mục tiêu: giữ schema Node hiện hành và bổ sung phân cấp địa điểm, điểm phục vụ
-- theo chuyến, snapshot đón/trả, trạng thái bán/vận hành tách biệt và thông tin
-- hoàn thành chuyến.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
  ON public.users(username)
  WHERE username IS NOT NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status public.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provinces_status_name_idx
  ON public.provinces(status, name);

-- Backfill tỉnh/thành từ dữ liệu Location hiện tại trước khi gắn FK.
INSERT INTO public.provinces(name)
SELECT DISTINCT btrim(province)
FROM public.locations
WHERE nullif(btrim(province), '') IS NOT NULL
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pickup_dropoff_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE RESTRICT,
  legacy_region text,
  name text NOT NULL,
  detailed_address text,
  sort_order integer NOT NULL DEFAULT 0,
  status public.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT pickup_dropoff_areas_province_name_key UNIQUE (province_id, name)
);
CREATE INDEX IF NOT EXISTS pickup_dropoff_areas_province_status_sort_idx
  ON public.pickup_dropoff_areas(province_id, status, sort_order);

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS province_id uuid,
  ADD COLUMN IF NOT EXISTS default_area_id uuid,
  ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'BOTH',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.locations AS l
SET province_id = p.id
FROM public.provinces AS p
WHERE l.province_id IS NULL
  AND p.name = btrim(l.province);

UPDATE public.locations
SET normalized_name = lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))
WHERE normalized_name IS NULL;

-- Tạo một bộ lọc mặc định tương thích từ từng Location phẳng hiện tại.
INSERT INTO public.pickup_dropoff_areas(
  province_id,
  legacy_region,
  name,
  detailed_address,
  sort_order,
  status
)
SELECT
  l.province_id,
  l.province,
  l.name,
  l.address,
  l.sort_order,
  l.status
FROM public.locations AS l
WHERE l.province_id IS NOT NULL
ON CONFLICT (province_id, name) DO NOTHING;

UPDATE public.locations AS l
SET default_area_id = a.id
FROM public.pickup_dropoff_areas AS a
WHERE l.default_area_id IS NULL
  AND a.province_id = l.province_id
  AND a.name = l.name;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_province_id_fkey'
  ) THEN
    ALTER TABLE public.locations
      ADD CONSTRAINT locations_province_id_fkey
      FOREIGN KEY (province_id) REFERENCES public.provinces(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_default_area_id_fkey'
  ) THEN
    ALTER TABLE public.locations
      ADD CONSTRAINT locations_default_area_id_fkey
      FOREIGN KEY (default_area_id) REFERENCES public.pickup_dropoff_areas(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_location_type_check'
  ) THEN
    ALTER TABLE public.locations
      ADD CONSTRAINT locations_location_type_check
      CHECK (location_type IN ('PICKUP', 'DROPOFF', 'BOTH'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS locations_province_normalized_name_key
  ON public.locations(province_id, normalized_name)
  WHERE province_id IS NOT NULL AND normalized_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS locations_province_status_sort_idx
  ON public.locations(province_id, status, sort_order);
CREATE INDEX IF NOT EXISTS locations_default_area_id_idx
  ON public.locations(default_area_id);

CREATE TABLE IF NOT EXISTS public.location_area_filters (
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.pickup_dropoff_areas(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, area_id)
);
CREATE INDEX IF NOT EXISTS location_area_filters_area_location_idx
  ON public.location_area_filters(area_id, location_id);

INSERT INTO public.location_area_filters(location_id, area_id)
SELECT id, default_area_id
FROM public.locations
WHERE default_area_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.pickup_dropoff_areas(id) ON DELETE RESTRICT,
  point_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status public.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT route_stops_route_area_type_key UNIQUE (route_id, area_id, point_type),
  CONSTRAINT route_stops_point_type_check CHECK (point_type IN ('PICKUP', 'DROPOFF'))
);
CREATE INDEX IF NOT EXISTS route_stops_route_type_status_sort_idx
  ON public.route_stops(route_id, point_type, status, sort_order);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS departure_specific_location_id uuid,
  ADD COLUMN IF NOT EXISTS arrival_specific_location_id uuid,
  ADD COLUMN IF NOT EXISTS primary_pickup_mode text NOT NULL DEFAULT 'DonTaiBenXe',
  ADD COLUMN IF NOT EXISTS primary_dropoff_mode text NOT NULL DEFAULT 'TraTaiBenXe',
  ADD COLUMN IF NOT EXISTS allow_pickup_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_pickup_meeting_point boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_dropoff_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_dropoff_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_status text NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS operation_status text NOT NULL DEFAULT 'NOT_DEPARTED',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz(6);

-- Route hiện tại đã chứa địa điểm cụ thể; dùng nó để backfill Chuyến.
UPDATE public.trips AS t
SET
  departure_specific_location_id = COALESCE(t.departure_specific_location_id, r.departure_location_id),
  arrival_specific_location_id = COALESCE(t.arrival_specific_location_id, r.arrival_location_id)
FROM public.routes AS r
WHERE r.id = t.route_id;

UPDATE public.trips
SET sales_status = CASE WHEN status = 'OPEN' THEN 'OPEN' ELSE 'CLOSED' END;

UPDATE public.trips
SET operation_status = CASE
  WHEN status = 'DEPARTED' THEN 'DEPARTED'
  WHEN status = 'COMPLETED' THEN 'COMPLETED'
  WHEN status = 'CANCELLED' THEN 'CANCELLED'
  ELSE 'NOT_DEPARTED'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_departure_specific_location_id_fkey'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_departure_specific_location_id_fkey
      FOREIGN KEY (departure_specific_location_id) REFERENCES public.locations(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_arrival_specific_location_id_fkey'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_arrival_specific_location_id_fkey
      FOREIGN KEY (arrival_specific_location_id) REFERENCES public.locations(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_sales_status_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_sales_status_check
      CHECK (sales_status IN ('OPEN', 'CLOSED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_operation_status_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_operation_status_check
      CHECK (operation_status IN ('NOT_DEPARTED', 'DEPARTED', 'COMPLETED', 'CANCELLED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_primary_pickup_mode_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_primary_pickup_mode_check
      CHECK (primary_pickup_mode IN ('TaiVanPhong', 'DonTaiBenXe'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_primary_dropoff_mode_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_primary_dropoff_mode_check
      CHECK (primary_dropoff_mode IN ('TraTaiBenXe', 'TraTaiVanPhong'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trips_specific_locations_departure_idx
  ON public.trips(departure_specific_location_id, arrival_specific_location_id, departure_time);
CREATE INDEX IF NOT EXISTS trips_sales_operation_departure_idx
  ON public.trips(sales_status, operation_status, departure_time);

CREATE TABLE IF NOT EXISTS public.trip_service_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  point_type text NOT NULL,
  service_mode text NOT NULL,
  legacy_estimated_minutes integer NOT NULL DEFAULT 0,
  estimated_time time(0),
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  status public.record_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT trip_service_points_trip_location_type_key UNIQUE (trip_id, location_id, point_type),
  CONSTRAINT trip_service_points_point_type_check CHECK (point_type IN ('PICKUP', 'DROPOFF')),
  CONSTRAINT trip_service_points_service_mode_check CHECK (
    service_mode IN (
      'TaiVanPhong',
      'DonTaiBenXe',
      'DonTaiDiemHen',
      'TrungChuyenDonKhach',
      'TraTaiBenXe',
      'TraTaiVanPhong',
      'TraTaiDiemDung',
      'TrungChuyenTraKhach'
    )
  )
);
CREATE INDEX IF NOT EXISTS trip_service_points_trip_type_status_sort_idx
  ON public.trip_service_points(trip_id, point_type, status, sort_order);
CREATE INDEX IF NOT EXISTS trip_service_points_location_status_idx
  ON public.trip_service_points(location_id, status);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_location_id uuid,
  ADD COLUMN IF NOT EXISTS dropoff_location_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_service_point_id uuid,
  ADD COLUMN IF NOT EXISTS dropoff_service_point_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_service_mode text,
  ADD COLUMN IF NOT EXISTS dropoff_service_mode text,
  ADD COLUMN IF NOT EXISTS pickup_kind text,
  ADD COLUMN IF NOT EXISTS dropoff_kind text,
  ADD COLUMN IF NOT EXISTS pickup_requested_address text,
  ADD COLUMN IF NOT EXISTS dropoff_requested_address text,
  ADD COLUMN IF NOT EXISTS sms_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_pickup_location_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pickup_location_id_fkey
      FOREIGN KEY (pickup_location_id) REFERENCES public.locations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_dropoff_location_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_dropoff_location_id_fkey
      FOREIGN KEY (dropoff_location_id) REFERENCES public.locations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_pickup_service_point_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pickup_service_point_id_fkey
      FOREIGN KEY (pickup_service_point_id) REFERENCES public.trip_service_points(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_dropoff_service_point_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_dropoff_service_point_id_fkey
      FOREIGN KEY (dropoff_service_point_id) REFERENCES public.trip_service_points(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_pickup_location_id_idx
  ON public.bookings(pickup_location_id);
CREATE INDEX IF NOT EXISTS bookings_dropoff_location_id_idx
  ON public.bookings(dropoff_location_id);
CREATE INDEX IF NOT EXISTS bookings_pickup_service_point_id_idx
  ON public.bookings(pickup_service_point_id);
CREATE INDEX IF NOT EXISTS bookings_dropoff_service_point_id_idx
  ON public.bookings(dropoff_service_point_id);
