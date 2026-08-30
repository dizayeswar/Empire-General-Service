-- EGS — electrical minus table

begin;

create table if not exists public.electrical_minus (
  id text primary key,
  num bigint,
  unit text not null default '',
  date text not null default '',
  time text not null default '',
  agent text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at text not null default ''
);

create index if not exists electrical_minus_date_idx on public.electrical_minus(date);
create index if not exists electrical_minus_agent_idx on public.electrical_minus(agent);

alter table public.electrical_minus enable row level security;

commit;
