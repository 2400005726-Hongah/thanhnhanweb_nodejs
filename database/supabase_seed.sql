-- Seed idempotent: không tạo admin, chuyến xe hoặc mật khẩu.
insert into public.locations (name, province, address) values
  ('Krông Năng', 'Đắk Lắk', null),
  ('Buôn Hồ', 'Đắk Lắk', null),
  ('Thành phố Hồ Chí Minh', 'Thành phố Hồ Chí Minh', null)
on conflict do nothing;

insert into public.routes (route_name, departure_location_id, arrival_location_id, distance_km, estimated_duration_minutes)
select v.route_name, d.id, a.id, v.distance_km, v.duration
from (values
 ('Krông Năng → Thành phố Hồ Chí Minh','Krông Năng','Đắk Lắk','Thành phố Hồ Chí Minh','Thành phố Hồ Chí Minh',380.00,480),
 ('Thành phố Hồ Chí Minh → Krông Năng','Thành phố Hồ Chí Minh','Thành phố Hồ Chí Minh','Krông Năng','Đắk Lắk',380.00,480),
 ('Buôn Hồ → Thành phố Hồ Chí Minh','Buôn Hồ','Đắk Lắk','Thành phố Hồ Chí Minh','Thành phố Hồ Chí Minh',350.00,450),
 ('Thành phố Hồ Chí Minh → Buôn Hồ','Thành phố Hồ Chí Minh','Thành phố Hồ Chí Minh','Buôn Hồ','Đắk Lắk',350.00,450)
) as v(route_name,d_name,d_province,a_name,a_province,distance_km,duration)
join public.locations d on lower(d.name)=lower(v.d_name) and lower(d.province)=lower(v.d_province)
join public.locations a on lower(a.name)=lower(v.a_name) and lower(a.province)=lower(v.a_province)
on conflict (departure_location_id, arrival_location_id) do nothing;

insert into public.buses (bus_name, license_plate, bus_type, capacity) values
 ('Xe giường nằm 44 giường','47B-044.44','SLEEPER',44),
 ('Xe limousine 22 phòng','47B-022.22','LIMOUSINE',22)
on conflict do nothing;

-- 44 ghế: tầng 1 A01-A22, tầng 2 B01-B22.
insert into public.seats (bus_id, seat_code, floor, seat_type)
select b.id, case when g.n <= 22 then 'A' else 'B' end || lpad(((g.n-1)%22+1)::text,2,'0'),
       case when g.n <= 22 then 1 else 2 end, 'NORMAL'::public.seat_type
from public.buses b cross join generate_series(1,44) g(n)
where upper(regexp_replace(b.license_plate,'[^A-Za-z0-9]','','g'))='47B04444'
on conflict (bus_id, seat_code) do nothing;

-- 22 phòng VIP: tầng 1 L01-L11, tầng 2 U01-U11.
insert into public.seats (bus_id, seat_code, floor, seat_type)
select b.id, case when g.n <= 11 then 'L' else 'U' end || lpad(((g.n-1)%11+1)::text,2,'0'),
       case when g.n <= 11 then 1 else 2 end, 'VIP'::public.seat_type
from public.buses b cross join generate_series(1,22) g(n)
where upper(regexp_replace(b.license_plate,'[^A-Za-z0-9]','','g'))='47B02222'
on conflict (bus_id, seat_code) do nothing;
