-- ============================================================
-- Renovation Finance Tracker - initial schema
-- Single-user (per auth.uid()) multi-tenant-safe design.
-- NOTE: this project has "Automatically expose new tables" DISABLED,
-- so every table needs an explicit GRANT for the `authenticated` role
-- to be reachable through the Data API (PostgREST). See migration
-- 20260809092746_renovation_tracker_rls_policies_and_grants.sql.
-- RLS is auto-enabled on new tables, but we enable it explicitly too.
-- ============================================================

-- ---------- helper: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- enums ----------
do $$ begin
  create type public.line_item_type as enum ('work', 'request');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.funding_source as enum ('loan', 'own');
exception when duplicate_object then null; end $$;

-- ============================================================
-- settings (one row per user)
-- ============================================================
create table if not exists public.settings (
  user_id                uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  loan_amount            numeric(14, 2) not null default 0,
  own_contribution       numeric(14, 2) not null default 0,
  default_vat_rate       numeric(5, 2)  not null default 21.00,
  vat_rates              numeric(5, 2)[] not null default '{6.00,21.00}',
  deadline_warning_days  integer        not null default 14 check (deadline_warning_days between 1 and 365),
  currency               text           not null default 'EUR',
  locale                 text           not null default 'nl-BE',
  created_at             timestamptz    not null default now(),
  updated_at             timestamptz    not null default now()
);

comment on table public.settings is 'Per-user configuration: total renovation loan, own contribution, VAT defaults, dashboard warning window.';

-- ============================================================
-- suppliers
-- ============================================================
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name         text not null check (length(btrim(name)) > 0),
  contact_name text,
  email        text,
  phone        text,
  website      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists suppliers_user_id_idx on public.suppliers (user_id);
create index if not exists suppliers_user_name_idx on public.suppliers (user_id, name);

-- ============================================================
-- line_items (works + utility/connection requests, unified)
-- ============================================================
create table if not exists public.line_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade default auth.uid(),
  type                public.line_item_type not null default 'work',
  description         text not null check (length(btrim(description)) > 0),
  supplier_id         uuid references public.suppliers (id) on delete set null,
  amount_excl_vat     numeric(14, 2) not null default 0,
  vat_rate            numeric(5, 2)  not null default 21.00 check (vat_rate >= 0 and vat_rate <= 100),
  amount_incl_vat     numeric(14, 2) generated always as
                        (round(amount_excl_vat * (1 + vat_rate / 100), 2)) stored,
  source              public.funding_source not null default 'loan',
  offer_received      boolean not null default false,
  invoice_received    boolean not null default false,
  requested_from_bank boolean not null default false,
  paid                boolean not null default false,
  request_submitted   boolean not null default false,
  due_date            date,
  attachment_url      text,
  disabled            boolean not null default false,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column public.line_items.request_submitted is 'Only meaningful for type = request: has the utility/connection request been submitted yet.';
comment on column public.line_items.paid is 'Top-level paid flag. Ignored when the item has installments configured - then paid status is derived from the installments.';
comment on column public.line_items.disabled is 'Disabled rows stay visible for reference but are excluded from every calculation.';

create index if not exists line_items_user_id_idx on public.line_items (user_id);
create index if not exists line_items_supplier_id_idx on public.line_items (supplier_id);
create index if not exists line_items_user_due_date_idx on public.line_items (user_id, due_date);

-- ============================================================
-- installments (partial payments of a work line item)
-- ============================================================
create table if not exists public.installments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  line_item_id uuid not null references public.line_items (id) on delete cascade,
  label        text not null default '',
  amount       numeric(14, 2) not null default 0,
  percentage   numeric(6, 3) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  due_date     date,
  paid         boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.installments.amount is 'Amount incl. VAT for this installment. Kept in sync by the client when percentage is used.';
comment on column public.installments.percentage is 'Optional percentage of the parent line item total; when set the amount is derived from it.';

create index if not exists installments_user_id_idx on public.installments (user_id);
create index if not exists installments_line_item_id_idx on public.installments (line_item_id, sort_order);
create index if not exists installments_user_due_date_idx on public.installments (user_id, due_date);

-- ============================================================
-- comments
-- ============================================================
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  line_item_id uuid not null references public.line_items (id) on delete cascade,
  body         text not null check (length(btrim(body)) > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists comments_line_item_id_idx on public.comments (line_item_id, created_at);

-- ============================================================
-- todos
-- ============================================================
create table if not exists public.todos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title        text not null check (length(btrim(title)) > 0),
  notes        text,
  done         boolean not null default false,
  due_date     date,
  priority     smallint not null default 1 check (priority between 0 and 2),
  sort_order   integer not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.todos.priority is '0 = low, 1 = normal, 2 = high';

create index if not exists todos_user_id_idx on public.todos (user_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists line_items_set_updated_at on public.line_items;
create trigger line_items_set_updated_at before update on public.line_items
  for each row execute function public.set_updated_at();

drop trigger if exists installments_set_updated_at on public.installments;
create trigger installments_set_updated_at before update on public.installments
  for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at before update on public.todos
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.settings     enable row level security;
alter table public.suppliers    enable row level security;
alter table public.line_items   enable row level security;
alter table public.installments enable row level security;
alter table public.comments     enable row level security;
alter table public.todos        enable row level security;
