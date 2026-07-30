-- Điều chỉnh phân quyền ADMIN/STAFF và bổ sung tin tức, nhật ký thao tác.
-- Migration chỉ thêm enum/cột/bảng/index; không xóa hoặc viết lại dữ liệu hiện có.

alter type public.user_role add value if not exists 'STAFF';
alter type public.booking_status add value if not exists 'NO_SHOW';

alter table public.routes
  add column if not exists default_ticket_price numeric(12,2)
  check (default_ticket_price is null or default_ticket_price >= 0);

do $$
begin
  create type public.news_status as enum ('ACTIVE', 'INACTIVE', 'DRAFT', 'PUBLISHED');
exception
  when duplicate_object then null;
end $$;

alter table public.bookings
  add column if not exists no_show_reason text,
  add column if not exists no_show_at timestamptz,
  add column if not exists no_show_by_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_show_by_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_no_show_by_id_fkey
      foreign key (no_show_by_id) references public.users(id) on delete set null;
  end if;
end $$;

create index if not exists bookings_no_show_by_id_idx
  on public.bookings (no_show_by_id);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  content text not null,
  thumbnail_url text,
  status public.news_status not null default 'DRAFT',
  published_at timestamptz,
  created_by_id uuid not null references public.users(id) on delete restrict,
  updated_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_status_published_at_idx
  on public.news (status, published_at);
create index if not exists news_created_by_created_at_idx
  on public.news (created_by_id, created_at);
create index if not exists news_updated_by_id_idx
  on public.news (updated_by_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  role public.user_role not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_at_idx
  on public.audit_logs (user_id, created_at);
create index if not exists audit_logs_entity_created_at_idx
  on public.audit_logs (entity_type, entity_id, created_at);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'news_set_updated_at'
  ) then
    create trigger news_set_updated_at
      before update on public.news
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Backend dùng Prisma qua kết nối PostgreSQL trực tiếp.
-- Không mở hai bảng quản trị cho Data API công khai.
alter table public.news enable row level security;
alter table public.audit_logs enable row level security;
revoke all on table public.news from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

comment on table public.news is
  'Tin tức do ADMIN và STAFF quản lý; không truy cập trực tiếp từ frontend.';
comment on table public.audit_logs is
  'Nhật ký thao tác quản trị; chỉ ADMIN được xem qua backend.';
