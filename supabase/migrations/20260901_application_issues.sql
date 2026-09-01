-- EGS — application customer / portal issues board

begin;

create table if not exists public.application_issues (
  id text primary key,
  num bigint,
  kind text not null default 'customer',
  project text not null default '',
  property_id text not null default '',
  note text not null default '',
  photo text not null default '',
  status text not null default 'open',
  created_by text not null default '',
  created_at text not null default '',
  fixed_by text not null default '',
  fixed_at text not null default ''
);

create index if not exists application_issues_kind_status_idx
  on public.application_issues (kind, status);

create index if not exists application_issues_created_at_idx
  on public.application_issues (created_at desc);

alter table public.application_issues enable row level security;

commit;
