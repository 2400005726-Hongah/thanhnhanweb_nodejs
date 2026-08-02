-- Giai đoạn 3: giá theo loại giường/phòng và fallback giá tuyến.
-- Migration chỉ bổ sung cột nullable, cho phép ticket_price nullable và
-- thêm ràng buộc không âm. Không đổi loại xe, ghế, TripSeat hay Booking cũ.

do $$
begin
  if exists (
    select 1
    from public.trips
    where single_room_price < 0
       or double_room_price < 0
  ) then
    raise exception
      'Không thể áp dụng Giai đoạn 3: trips đang có giá phòng âm';
  end if;
end $$;

alter table public.routes
  add column if not exists default_single_room_price numeric(12, 2),
  add column if not exists default_double_room_price numeric(12, 2);

alter table public.trips
  alter column ticket_price drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'routes_default_single_room_price_nonnegative'
      and conrelid = 'public.routes'::regclass
  ) then
    alter table public.routes
      add constraint routes_default_single_room_price_nonnegative
      check (
        default_single_room_price is null
        or default_single_room_price >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'routes_default_double_room_price_nonnegative'
      and conrelid = 'public.routes'::regclass
  ) then
    alter table public.routes
      add constraint routes_default_double_room_price_nonnegative
      check (
        default_double_room_price is null
        or default_double_room_price >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_single_room_price_nonnegative'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_single_room_price_nonnegative
      check (single_room_price is null or single_room_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_double_room_price_nonnegative'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_double_room_price_nonnegative
      check (double_room_price is null or double_room_price >= 0);
  end if;
end $$;
