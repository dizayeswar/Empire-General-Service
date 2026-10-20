-- EGS — A.S.A.A.S leave approvals
-- Query name in SQL Editor: EGS — A.S.A.A.S leave approvals
-- Adds the Confirm → Line Manager → Director flow to asaas_leave_requests.
-- status: saved | pending_line | pending_director | completed | rejected

begin;

alter table public.asaas_leave_requests
  add column if not exists status text not null default 'saved',
  add column if not exists confirmed_by text not null default '',
  add column if not exists confirmed_at text not null default '',
  add column if not exists line_signature text not null default '',
  add column if not exists line_signed_by text not null default '',
  add column if not exists line_signed_at text not null default '',
  add column if not exists director_signature text not null default '',
  add column if not exists director_signed_by text not null default '',
  add column if not exists director_signed_at text not null default '',
  add column if not exists reject_reason text not null default '',
  add column if not exists rejected_by text not null default '',
  add column if not exists rejected_at text not null default '';

create index if not exists asaas_leave_requests_status_idx on public.asaas_leave_requests(status);

commit;
