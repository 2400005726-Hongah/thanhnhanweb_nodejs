-- Chỉ đọc dữ liệu/metadata; không sửa hoặc xóa.
select table_name from information_schema.tables where table_schema='public' and table_name in
 ('users','locations','routes','buses','seats','trips','trip_seats','bookings','booking_items','payments') order by table_name;

select tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name as referenced_table, ccu.column_name as referenced_column
from information_schema.table_constraints tc join information_schema.key_column_usage kcu using (constraint_catalog,constraint_schema,constraint_name)
join information_schema.constraint_column_usage ccu using (constraint_catalog,constraint_schema,constraint_name)
where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY' order by tc.table_name,tc.constraint_name;

select tc.table_name, tc.constraint_name, string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc join information_schema.key_column_usage kcu using (constraint_catalog,constraint_schema,constraint_name)
where tc.table_schema='public' and tc.constraint_type='UNIQUE' group by tc.table_name,tc.constraint_name order by tc.table_name;

select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by tablename,indexname;

select 'locations' as entity, count(*) as total from public.locations
union all select 'routes', count(*) from public.routes
union all select 'buses', count(*) from public.buses;

select b.bus_name, b.license_plate, b.capacity, count(s.id) as seat_count
from public.buses b left join public.seats s on s.bus_id=b.id group by b.id order by b.bus_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in
 ('users','locations','routes','buses','seats','trips','trip_seats','bookings','booking_items','payments') order by c.relname;

select table_name, column_name from information_schema.columns
where table_schema='public' and lower(column_name)='password';
-- Kết quả truy vấn cuối phải là 0 dòng; password_hash là cột hợp lệ.
