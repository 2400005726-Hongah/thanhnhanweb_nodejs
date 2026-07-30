-- NHÀ XE THÀNH NHÂN - Supabase PostgreSQL schema
-- Dành cho Supabase project mới. Script không xóa bảng, type hoặc dữ liệu.

create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('CUSTOMER', 'ADMIN'); exception when duplicate_object then null; end $$;
do $$ begin create type public.user_status as enum ('ACTIVE', 'INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.record_status as enum ('ACTIVE', 'INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.bus_status as enum ('ACTIVE', 'MAINTENANCE', 'INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.seat_type as enum ('NORMAL', 'VIP'); exception when duplicate_object then null; end $$;
do $$ begin create type public.trip_status as enum ('OPEN', 'CLOSED', 'DEPARTED', 'COMPLETED', 'CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.trip_seat_status as enum ('AVAILABLE', 'HELD', 'BOOKED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('CASH', 'BANK_TRANSFER', 'SIMULATED'); exception when duplicate_object then null; end $$;

-- Tài khoản do backend JWT/bcryptjs quản lý. Chỉ lưu password_hash, không lưu mật khẩu thô.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text not null unique,
  password_hash text not null,
  role public.user_role not null default 'CUSTOMER',
  status public.user_status not null default 'ACTIVE',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_lower_key on public.users (lower(email));
create index if not exists users_email_idx on public.users (email);
create index if not exists users_phone_idx on public.users (phone);
create index if not exists users_role_status_idx on public.users (role, status);

-- Danh mục địa điểm và tuyến đường.
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(), name text not null, province text not null,
  address text, status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint locations_name_province_key unique (name, province)
);
create unique index if not exists locations_name_province_lower_key on public.locations (lower(name), lower(province));
create index if not exists locations_province_status_idx on public.locations (province, status);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(), route_name text not null,
  departure_location_id uuid not null references public.locations(id) on delete restrict,
  arrival_location_id uuid not null references public.locations(id) on delete restrict,
  distance_km numeric(10,2) not null check (distance_km > 0),
  estimated_duration_minutes integer not null check (estimated_duration_minutes > 0),
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint routes_different_locations_check check (departure_location_id <> arrival_location_id),
  constraint routes_departure_arrival_key unique (departure_location_id, arrival_location_id)
);
create index if not exists routes_status_name_idx on public.routes (status, route_name);

-- Xe và sơ đồ ghế mẫu của từng xe.
create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(), bus_name text not null, license_plate text not null unique,
  bus_type text not null, capacity integer not null check (capacity > 0),
  status public.bus_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists buses_license_plate_normalized_key on public.buses (upper(regexp_replace(license_plate, '[^A-Za-z0-9]', '', 'g')));
create index if not exists buses_status_bus_type_idx on public.buses (status, bus_type);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(), bus_id uuid not null references public.buses(id) on delete restrict,
  seat_code text not null, floor integer not null default 1 check (floor in (1,2)),
  seat_type public.seat_type not null default 'NORMAL', status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint seats_bus_seat_code_key unique (bus_id, seat_code)
);
create index if not exists seats_bus_status_seat_type_idx on public.seats (bus_id, status, seat_type);

-- Chuyến xe và snapshot trạng thái ghế theo chuyến.
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(), route_id uuid not null references public.routes(id) on delete restrict,
  bus_id uuid not null references public.buses(id) on delete restrict,
  departure_time timestamptz not null, expected_arrival_time timestamptz not null,
  ticket_price numeric(12,2) not null check (ticket_price >= 0),
  status public.trip_status not null default 'OPEN',
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint trips_arrival_after_departure_check check (expected_arrival_time > departure_time)
);
create index if not exists trips_route_departure_status_idx on public.trips (route_id, departure_time, status);
create index if not exists trips_bus_departure_arrival_idx on public.trips (bus_id, departure_time, expected_arrival_time);

create table if not exists public.trip_seats (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete restrict,
  seat_id uuid not null references public.seats(id) on delete restrict, seat_code text not null,
  floor integer not null check (floor in (1,2)), seat_type public.seat_type not null,
  price numeric(12,2) not null check (price >= 0), status public.trip_seat_status not null default 'AVAILABLE',
  held_by text, hold_expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint trip_seats_trip_seat_key unique (trip_id, seat_id),
  constraint trip_seats_trip_code_key unique (trip_id, seat_code),
  constraint trip_seats_hold_expiry_check check (status <> 'HELD' or hold_expires_at is not null)
);
create index if not exists trip_seats_trip_status_idx on public.trip_seats (trip_id, status);
create index if not exists trip_seats_hold_expires_at_idx on public.trip_seats (hold_expires_at);

-- Đặt vé, chi tiết ghế đã đặt và các lần thử thanh toán.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(), booking_code text not null unique,
  user_id uuid references public.users(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete restrict,
  passenger_full_name text not null, passenger_phone text not null, passenger_email text,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status public.booking_status not null default 'PENDING',
  payment_status public.payment_status not null default 'PENDING', expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists bookings_user_created_idx on public.bookings (user_id, created_at);
create index if not exists bookings_trip_status_idx on public.bookings (trip_id, status);
create index if not exists bookings_phone_code_idx on public.bookings (passenger_phone, booking_code);
create index if not exists bookings_created_at_idx on public.bookings (created_at);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete restrict,
  trip_seat_id uuid not null unique references public.trip_seats(id) on delete restrict,
  seat_code text not null, seat_type public.seat_type not null,
  price numeric(12,2) not null check (price >= 0), created_at timestamptz not null default now(),
  constraint booking_items_booking_trip_seat_key unique (booking_id, trip_seat_id)
);
create index if not exists booking_items_booking_id_idx on public.booking_items (booking_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete restrict,
  payment_method public.payment_method not null, amount numeric(12,2) not null check (amount >= 0),
  transaction_code text unique, status public.payment_status not null default 'PENDING', paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists payments_booking_status_created_idx on public.payments (booking_id, status, created_at);

-- Dùng một function chung để giữ updated_at chính xác khi UPDATE.
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['users','locations','routes','buses','seats','trips','trip_seats','bookings','payments']
  loop
    if not exists (select 1 from pg_trigger where tgname = table_name || '_set_updated_at') then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
    end if;
  end loop;
end $$;

-- RLS được bật nhưng chưa có policy: frontend không truy cập trực tiếp database.
-- Backend Node.js dùng Prisma + DATABASE_URL; không dùng SUPABASE_SECRET_KEY để kết nối PostgreSQL.
-- Policy chỉ bổ sung nếu sau này dùng Supabase Auth hoặc Data API.
alter table public.users enable row level security;
alter table public.locations enable row level security;
alter table public.routes enable row level security;
alter table public.buses enable row level security;
alter table public.seats enable row level security;
alter table public.trips enable row level security;
alter table public.trip_seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;

comment on table public.users is 'Tài khoản ứng dụng; frontend không truy cập trực tiếp, backend JWT/bcryptjs quản lý.';
comment on table public.locations is 'Danh mục địa điểm hoạt động của nhà xe.';
comment on table public.routes is 'Tuyến xe giữa hai địa điểm.';
comment on table public.buses is 'Thông tin xe khách.';
comment on table public.seats is 'Sơ đồ ghế mẫu của từng xe.';
comment on table public.trips is 'Lịch chuyến xe.';
comment on table public.trip_seats is 'Snapshot ghế và trạng thái ghế theo chuyến.';
comment on table public.bookings is 'Thông tin đặt vé và snapshot hành khách.';
comment on table public.booking_items is 'Ghế chuyến thuộc từng đơn đặt vé.';
comment on table public.payments is 'Các lần thử thanh toán của một đơn đặt vé.';
