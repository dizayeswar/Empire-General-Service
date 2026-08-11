-- Civil field reports (mobile Add report) + invoice photo on monthly jobs.

create table if not exists public.civil_worker_reports (
  id text primary key,
  date text not null default '',
  place text not null default '',
  note text not null default '',
  photo text not null default '',
  voice_note text not null default '',
  reported_by text not null default '',
  worker_name text not null default '',
  created_at text not null default '',
  amount numeric not null default 0,
  report_type text not null default 'maintenance',
  status text not null default '',
  transferred_job_id text not null default '',
  edited_note text not null default '',
  transferred_at text not null default '',
  transferred_by text not null default '',
  materials text not null default '',
  invoice_photo text not null default '',
  num bigint
);
create index if not exists civil_worker_reports_status_idx on public.civil_worker_reports(status);
create index if not exists civil_worker_reports_date_idx on public.civil_worker_reports(date);

alter table public.civil_worker_reports enable row level security;

alter table public.civil_jobs
  add column if not exists invoice_photo text not null default '';

insert into public.id_counters (key, value) values
  ('frnum_CivilWorkerReports', 0)
on conflict (key) do nothing;
