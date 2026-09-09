-- EGS — charging bot switch
-- Query name in SQL Editor: EGS — charging bot switch

begin;

create table if not exists public.charging_bot_state (
  id text primary key,
  enabled boolean not null default false,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.charging_bot_state (id, enabled, updated_by, updated_at)
values ('default', false, '', now())
on conflict (id) do nothing;

alter table public.charging_bot_state enable row level security;

commit;
