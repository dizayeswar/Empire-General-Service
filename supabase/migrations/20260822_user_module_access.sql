-- Per-account module access matrix (none | read | write).

alter table public.users
  add column if not exists module_access jsonb not null default '{}'::jsonb;
