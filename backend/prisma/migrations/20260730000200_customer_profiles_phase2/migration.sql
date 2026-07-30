-- Giai đoạn 2: chuẩn hóa hồ sơ Customer và hỗ trợ truy vấn vi phạm.
-- Migration không sửa snapshot hành khách trong Booking, không xóa dữ liệu
-- và không thêm UNIQUE mới trên phone (customers.phone đã có từ migration trước).

-- Dừng an toàn trước khi ghi nếu nhiều Customer hiện tại cùng quy về một số
-- điện thoại chuẩn hóa. Các bản ghi đó phải được xử lý thủ công để tránh gộp
-- nhầm lịch sử khách hàng.
do $$
declare
  duplicate_phone text;
begin
  with normalized_customers as (
    select
      case
        when regexp_replace(phone, '[^0-9]', '', 'g')
          ~ '^84(3|5|7|8|9)[0-9]{8}$'
          then '0' || substring(
            regexp_replace(phone, '[^0-9]', '', 'g') from 3
          )
        else regexp_replace(phone, '[^0-9]', '', 'g')
      end as normalized_phone
    from public.customers
  )
  select normalized_phone
  into duplicate_phone
  from normalized_customers
  where normalized_phone ~ '^0(3|5|7|8|9)[0-9]{8}$'
  group by normalized_phone
  having count(*) > 1
  limit 1;

  if duplicate_phone is not null then
    raise exception
      'Không thể chuẩn hóa Customer: số điện thoại % đang bị trùng',
      duplicate_phone;
  end if;
end $$;

-- Chuẩn hóa phone của Customer hiện có. Số không hợp lệ được giữ nguyên để
-- người quản trị kiểm tra, không tự ý sửa dữ liệu không chắc chắn.
with normalized_customers as (
  select
    id,
    case
      when regexp_replace(phone, '[^0-9]', '', 'g')
        ~ '^84(3|5|7|8|9)[0-9]{8}$'
        then '0' || substring(
          regexp_replace(phone, '[^0-9]', '', 'g') from 3
        )
      else regexp_replace(phone, '[^0-9]', '', 'g')
    end as normalized_phone
  from public.customers
)
update public.customers as customer
set phone = normalized.normalized_phone
from normalized_customers as normalized
where customer.id = normalized.id
  and normalized.normalized_phone ~ '^0(3|5|7|8|9)[0-9]{8}$'
  and customer.phone is distinct from normalized.normalized_phone;

-- Backfill một Customer cho mỗi số điện thoại Booking hợp lệ. Chỉ dùng
-- Booking mới nhất làm hồ sơ gợi ý; không cập nhật snapshot hành khách cũ.
with booking_candidates as (
  select
    b.passenger_full_name,
    b.passenger_email,
    b.created_at,
    case
      when regexp_replace(b.passenger_phone, '[^0-9]', '', 'g')
        ~ '^84(3|5|7|8|9)[0-9]{8}$'
        then '0' || substring(
          regexp_replace(b.passenger_phone, '[^0-9]', '', 'g') from 3
        )
      else regexp_replace(b.passenger_phone, '[^0-9]', '', 'g')
    end as normalized_phone
  from public.bookings as b
),
latest_booking_per_phone as (
  select distinct on (normalized_phone)
    coalesce(
      nullif(btrim(passenger_full_name), ''),
      'Khách hàng'
    ) as full_name,
    normalized_phone as phone,
    nullif(lower(btrim(passenger_email)), '') as email
  from booking_candidates
  where normalized_phone ~ '^0(3|5|7|8|9)[0-9]{8}$'
  order by normalized_phone, created_at desc
)
insert into public.customers (full_name, phone, email)
select full_name, phone, email
from latest_booking_per_phone
on conflict (phone) do nothing;

-- Liên kết Booking cũ với Customer theo số đã chuẩn hóa nhưng giữ nguyên các
-- cột passenger_full_name/passenger_phone/passenger_email của Booking.
with booking_phones as (
  select
    id,
    case
      when regexp_replace(passenger_phone, '[^0-9]', '', 'g')
        ~ '^84(3|5|7|8|9)[0-9]{8}$'
        then '0' || substring(
          regexp_replace(passenger_phone, '[^0-9]', '', 'g') from 3
        )
      else regexp_replace(passenger_phone, '[^0-9]', '', 'g')
    end as normalized_phone
  from public.bookings
  where customer_id is null
)
update public.bookings as booking
set customer_id = customer.id
from booking_phones as normalized
join public.customers as customer
  on customer.phone = normalized.normalized_phone
where booking.id = normalized.id
  and booking.customer_id is null;

-- Tối ưu phép đếm CANCELLED + NO_SHOW theo Customer.
create index if not exists bookings_customer_status_idx
  on public.bookings(customer_id, status);
