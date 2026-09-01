-- EGS — application issue problem / solution descriptions

begin;

alter table public.application_issues
  add column if not exists problem text not null default '';

alter table public.application_issues
  add column if not exists solution text not null default '';

commit;
