-- Nâng cấp nghiệp vụ đầy đủ cho Nhà xe Thành Nhân.
-- Migration chỉ bổ sung enum/cột/bảng/index và bỏ UNIQUE sai trên trip_seat_id.
-- Không xóa Booking, BookingItem, Payment hay dữ liệu lịch sử.

alter type public.seat_type add value if not exists 'SINGLE_ROOM';
alter type public.seat_type add value if not exists 'DOUBLE_ROOM';
alter type public.booking_status add value if not exists 'DELETED';
alter type public.payment_method add value if not exists 'COUNTER_CASH';
alter type public.payment_method add value if not exists 'BANK_QR';
alter type public.payment_method add value if not exists 'MOMO';
alter type public.payment_method add value if not exists 'ZALOPAY';
alter type public.payment_method add value if not exists 'VNPAY';
alter type public.payment_method add value if not exists 'POS';
alter type public.payment_method add value if not exists 'PAY_AT_BUS';

do $$ begin
  create type public.booking_source as enum ('ONLINE', 'HOTLINE', 'COUNTER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.customer_status as enum ('ACTIVE', 'BLOCKED');
exception when duplicate_object then null;
end $$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  email text,
  status public.customer_status not null default 'ACTIVE',
  blocked_reason text,
  blocked_at timestamptz,
  blocked_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_status_name_idx on public.customers(status, full_name);
create index if not exists customers_email_idx on public.customers(email);

-- Tạo hồ sơ khách cho dữ liệu booking cũ theo số điện thoại đã lưu.
insert into public.customers (full_name, phone, email)
select distinct on (b.passenger_phone)
  b.passenger_full_name,
  b.passenger_phone,
  nullif(b.passenger_email, '')
from public.bookings b
where b.passenger_phone is not null and btrim(b.passenger_phone) <> ''
order by b.passenger_phone, b.created_at desc
on conflict (phone) do nothing;

alter table public.trips
  add column if not exists single_room_price numeric(12,2),
  add column if not exists double_room_price numeric(12,2);

alter table public.bookings
  add column if not exists customer_id uuid,
  add column if not exists source public.booking_source not null default 'ONLINE',
  add column if not exists customer_note text,
  add column if not exists staff_note text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_id uuid,
  add column if not exists deleted_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_id uuid,
  add column if not exists created_by_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_customer_id_fkey') then
    alter table public.bookings add constraint bookings_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_cancelled_by_id_fkey') then
    alter table public.bookings add constraint bookings_cancelled_by_id_fkey
      foreign key (cancelled_by_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_deleted_by_id_fkey') then
    alter table public.bookings add constraint bookings_deleted_by_id_fkey
      foreign key (deleted_by_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_created_by_id_fkey') then
    alter table public.bookings add constraint bookings_created_by_id_fkey
      foreign key (created_by_id) references public.users(id) on delete set null;
  end if;
end $$;

create index if not exists bookings_customer_created_idx on public.bookings(customer_id, created_at);
create index if not exists bookings_source_created_idx on public.bookings(source, created_at);
create index if not exists bookings_cancelled_by_id_idx on public.bookings(cancelled_by_id);
create index if not exists bookings_deleted_by_id_idx on public.bookings(deleted_by_id);
create index if not exists bookings_created_by_id_idx on public.bookings(created_by_id);

update public.bookings b
set customer_id = c.id
from public.customers c
where b.customer_id is null and c.phone = b.passenger_phone;

-- BookingItem lịch sử không được chặn việc đặt lại một TripSeat đã giải phóng.
alter table public.booking_items drop constraint if exists booking_items_trip_seat_id_key;
drop index if exists public.booking_items_trip_seat_id_key;
create index if not exists booking_items_trip_seat_id_idx on public.booking_items(trip_seat_id);
create unique index if not exists booking_items_booking_id_trip_seat_id_key
  on public.booking_items(booking_id, trip_seat_id);

alter table public.audit_logs
  alter column user_id drop not null,
  alter column role drop not null,
  add column if not exists actor_name text,
  add column if not exists reason text,
  add column if not exists metadata jsonb;

alter table public.audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs add constraint audit_logs_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

create index if not exists payments_method_status_created_idx
  on public.payments(payment_method, status, created_at);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'customers_set_updated_at') then
    create trigger customers_set_updated_at before update on public.customers
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.customers enable row level security;
revoke all on table public.customers from anon, authenticated;
