-- EGS — charging requests
-- Query name in SQL Editor: EGS — charging requests

begin;

create table if not exists public.charging_requests (
  id text primary key,
  ru text not null,
  unit_id text not null default '',
  nova_search text not null default '',
  electric_type text not null default '',
  tariff text not null default '',
  amount text not null default '',
  status text not null default 'cannot_charge',
  note text not null default '',
  invoice_url text not null default '',
  retry_requested boolean not null default false,
  source text not null default 'nova',
  created_by text not null default '',
  updated_by text not null default '',
  charged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists charging_requests_ru_uidx
  on public.charging_requests (ru);

create index if not exists charging_requests_status_idx
  on public.charging_requests (status);

create index if not exists charging_requests_created_at_idx
  on public.charging_requests (created_at desc);

create index if not exists charging_requests_retry_idx
  on public.charging_requests (retry_requested)
  where retry_requested = true;

alter table public.charging_requests enable row level security;

commit;
