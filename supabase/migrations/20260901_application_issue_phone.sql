-- EGS — application issue phone number

begin;

alter table public.application_issues
  add column if not exists phone text not null default '';

commit;
