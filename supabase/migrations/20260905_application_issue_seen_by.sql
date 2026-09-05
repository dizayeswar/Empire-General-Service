-- EGS — application issue seen by

begin;

alter table public.application_issues
  add column if not exists seen_by text not null default '[]';

commit;
