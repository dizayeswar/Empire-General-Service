-- EGS — A.S.A.A.S leave requests
-- Query name in SQL Editor: EGS — A.S.A.A.S leave requests table

begin;

create table if not exists public.asaas_leave_requests (
  id text primary key,
  employee_name text not null default '',
  leave_type text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  form jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at text not null default '',
  updated_by text not null default '',
  updated_at text not null default ''
);
create index if not exists asaas_leave_requests_created_idx on public.asaas_leave_requests(created_at);

alter table public.asaas_leave_requests enable row level security;

commit;
