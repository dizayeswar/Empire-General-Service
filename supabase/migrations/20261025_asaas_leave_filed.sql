-- EGS — A.S.A.A.S leave filing
-- Query name in SQL Editor: EGS — A.S.A.A.S leave filing
-- Which Type of Leave folder a completed paper is filed in (annual, sick, unpaid, bereavement, marriage, other; blank = not filed).

begin;

alter table public.asaas_leave_requests
  add column if not exists filed_type text not null default '',
  add column if not exists filed_by text not null default '',
  add column if not exists filed_at text not null default '';

commit;
