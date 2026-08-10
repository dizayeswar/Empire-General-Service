-- Empire EGS — Postgres schema (1:1 from Google Sheets)
-- Apply in Supabase SQL Editor or via: supabase db push
-- Service role (Edge Function) bypasses RLS; anon/authenticated have no table access.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  username text primary key,
  password_hash text not null default '',
  dept text not null default '',
  role text not null default 'editor',
  hide text not null default '',
  projects text not null default '',
  trade text not null default '',
  hide_electrical text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  token text primary key,
  username text not null references public.users(username) on delete cascade,
  dept text not null default '',
  created_at bigint not null,
  role text not null default '',
  pw_digest text not null default ''
);
create index if not exists sessions_username_idx on public.sessions(username);
create index if not exists sessions_created_at_idx on public.sessions(created_at);

-- ---------------------------------------------------------------------------
-- Cleaning
-- ---------------------------------------------------------------------------
create table if not exists public.cleaning_reports (
  id text primary key,
  date text not null default '',
  project text not null default '',
  building text not null default '',
  employees text not null default '',
  level text not null default '',
  floors text not null default '',
  photo text not null default '',
  created_by text not null default '',
  created_at text not null default ''
);
create index if not exists cleaning_reports_project_idx on public.cleaning_reports(project);
create index if not exists cleaning_reports_date_idx on public.cleaning_reports(date);

-- Dual-use Tasks sheet: modern boolean rows + legacy JSON blob in `done_blob`
create table if not exists public.tasks (
  key text primary key,
  done boolean,
  done_blob text,
  updated_by text not null default '',
  updated_at text not null default ''
);

create table if not exists public.task_photos (
  id text primary key,
  project text not null default '',
  freq text not null default '',
  task text not null default '',
  date text not null default '',
  period text not null default '',
  image text not null default '',
  created_by text not null default '',
  created_at text not null default '',
  lat double precision,
  lng double precision,
  accuracy double precision,
  source text not null default 'camera'
);
create index if not exists task_photos_period_idx on public.task_photos(period);
create index if not exists task_photos_project_task_idx on public.task_photos(project, task);

create table if not exists public.week_coverage (
  week_start text not null,
  project text not null,
  task text not null,
  done boolean not null default false,
  image text not null default '',
  updated_by text not null default '',
  updated_at text not null default '',
  primary key (week_start, project, task)
);
create index if not exists week_coverage_week_idx on public.week_coverage(week_start);

create table if not exists public.task_log (
  id bigserial primary key,
  date text not null default '',
  project text not null default '',
  freq text not null default '',
  task text not null default '',
  done boolean not null default false,
  logged_by text not null default '',
  logged_at text not null default ''
);
create index if not exists task_log_date_idx on public.task_log(date);

-- ---------------------------------------------------------------------------
-- Issues (shared shape)
-- ---------------------------------------------------------------------------
create table if not exists public.civil_issues (
  id text primary key,
  project text not null default '',
  building text not null default '',
  floor text not null default '',
  spot text not null default '',
  issue_type text not null default '',
  note text not null default '',
  date text not null default '',
  photo text not null default '',
  fixed_photo text not null default '',
  status text not null default 'open',
  created_by text not null default '',
  created_at text not null default '',
  fixed_by text not null default '',
  fixed_at text not null default '',
  num bigint,
  assigned_group text not null default '',
  workers_required integer not null default 1,
  worker_completions jsonb not null default '[]'::jsonb,
  assigned_workers jsonb not null default '[]'::jsonb,
  disposition text not null default '',
  fix_delay text not null default '',
  assign_voice_note jsonb,
  monthly_transfer_status text not null default '',
  transferred_job_id text not null default '',
  edited_job_note text not null default '',
  transferred_at text not null default '',
  transferred_by text not null default ''
);
create index if not exists civil_issues_status_idx on public.civil_issues(status);
create index if not exists civil_issues_project_idx on public.civil_issues(project);
create index if not exists civil_issues_date_idx on public.civil_issues(date);

create table if not exists public.electric_issues (
  id text primary key,
  project text not null default '',
  building text not null default '',
  floor text not null default '',
  spot text not null default '',
  issue_type text not null default '',
  note text not null default '',
  date text not null default '',
  photo text not null default '',
  fixed_photo text not null default '',
  status text not null default 'open',
  created_by text not null default '',
  created_at text not null default '',
  fixed_by text not null default '',
  fixed_at text not null default '',
  num bigint,
  assigned_group text not null default '',
  workers_required integer not null default 1,
  worker_completions jsonb not null default '[]'::jsonb,
  assigned_workers jsonb not null default '[]'::jsonb,
  disposition text not null default '',
  fix_delay text not null default '',
  assign_voice_note jsonb,
  monthly_transfer_status text not null default '',
  transferred_job_id text not null default '',
  edited_job_note text not null default '',
  transferred_at text not null default '',
  transferred_by text not null default ''
);
create index if not exists electric_issues_status_idx on public.electric_issues(status);
create index if not exists electric_issues_project_idx on public.electric_issues(project);

create table if not exists public.fire_issues (
  id text primary key,
  project text not null default '',
  building text not null default '',
  floor text not null default '',
  spot text not null default '',
  issue_type text not null default '',
  note text not null default '',
  date text not null default '',
  photo text not null default '',
  fixed_photo text not null default '',
  status text not null default 'open',
  created_by text not null default '',
  created_at text not null default '',
  fixed_by text not null default '',
  fixed_at text not null default '',
  num bigint
);
create index if not exists fire_issues_status_idx on public.fire_issues(status);

create table if not exists public.hse_inspections (
  id text primary key,
  project text not null default '',
  building text not null default '',
  floor text not null default '',
  spot text not null default '',
  issue_type text not null default '',
  note text not null default '',
  date text not null default '',
  photo text not null default '',
  fixed_photo text not null default '',
  status text not null default 'open',
  created_by text not null default '',
  created_at text not null default '',
  fixed_by text not null default '',
  fixed_at text not null default '',
  num bigint,
  asset_key text not null default '',
  report_period text not null default '',
  job_dept text not null default ''
);
create index if not exists hse_inspections_status_idx on public.hse_inspections(status);

-- ---------------------------------------------------------------------------
-- Jobs / summaries / field reports
-- ---------------------------------------------------------------------------
create table if not exists public.civil_jobs (
  id text primary key,
  date text not null default '',
  job text not null default '',
  location text not null default '',
  materials text not null default '',
  staff text not null default '',
  type text not null default '',
  photo text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at text not null default '',
  amount text not null default ''
);
create index if not exists civil_jobs_date_idx on public.civil_jobs(date);

create table if not exists public.electrical_jobs (
  id text primary key,
  date text not null default '',
  job text not null default '',
  location text not null default '',
  materials text not null default '',
  staff text not null default '',
  type text not null default '',
  photo text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at text not null default '',
  amount text not null default '',
  num bigint
);
create index if not exists electrical_jobs_date_idx on public.electrical_jobs(date);

create table if not exists public.civil_summaries (
  month text primary key,
  text text not null default '',
  saved_by text not null default '',
  saved_at text not null default ''
);

create table if not exists public.electrical_summaries (
  month text primary key,
  text text not null default '',
  saved_by text not null default '',
  saved_at text not null default ''
);

create table if not exists public.electric_worker_reports (
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
create index if not exists electric_worker_reports_status_idx on public.electric_worker_reports(status);
create index if not exists electric_worker_reports_date_idx on public.electric_worker_reports(date);

-- ---------------------------------------------------------------------------
-- ASAAS / application checks
-- ---------------------------------------------------------------------------
create table if not exists public.asaas_items (
  id text primary key,
  num bigint,
  date text not null default '',
  building text not null default '',
  floor text not null default '',
  spot text not null default '',
  item_description text not null default '',
  photo text not null default '',
  apartment text not null default '',
  status text not null default 'in_warehouse',
  warehouse_note text not null default '',
  removed_by text not null default '',
  removed_by_name text not null default '',
  created_at text not null default '',
  returned_at text not null default '',
  returned_to text not null default '',
  return_apartment text not null default '',
  return_photo text not null default '',
  return_note text not null default '',
  updated_at text not null default '',
  photo2 text not null default ''
);
create index if not exists asaas_items_status_idx on public.asaas_items(status);

create table if not exists public.application_checks (
  id text primary key,
  project text not null default '',
  property_id text not null default '',
  phone text not null default '',
  status text not null default '',
  note text not null default '',
  updated_at text not null default '',
  updated_by text not null default ''
);
create index if not exists application_checks_project_idx on public.application_checks(project);

create table if not exists public.application_check_history (
  id text primary key,
  check_id text not null references public.application_checks(id) on delete cascade,
  field text not null default '',
  old_value text not null default '',
  new_value text not null default '',
  changed_at text not null default '',
  changed_by text not null default ''
);
create index if not exists application_check_history_check_idx on public.application_check_history(check_id);

-- ---------------------------------------------------------------------------
-- Trash / workers / misc
-- ---------------------------------------------------------------------------
create table if not exists public.trash (
  trash_id text primary key,
  source_sheet text not null,
  row_json jsonb not null,
  deleted_by text not null default '',
  deleted_at text not null default '',
  reason text not null default '',
  batch_id text not null default ''
);
create index if not exists trash_source_idx on public.trash(source_sheet);
create index if not exists trash_batch_idx on public.trash(batch_id);

create table if not exists public.worker_locations (
  username text primary key,
  trade text not null default '',
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  updated_at text not null default ''
);

create table if not exists public.worker_push_tokens (
  username text primary key,
  fcm_token text not null default '',
  platform text not null default '',
  updated_at text not null default ''
);

create table if not exists public.ui_settings (
  key text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.photo_migration_log (
  id bigserial primary key,
  old_url text not null,
  new_url text not null default '',
  source text not null default '',
  row_num integer,
  col_num integer,
  migrated_at text not null default ''
);
create index if not exists photo_migration_log_old_url_idx on public.photo_migration_log(old_url);

-- Never-reuse counters (replaces Script Properties issnum_*, jobnum_*, frnum_*, asanum_*)
create table if not exists public.id_counters (
  key text primary key,
  value bigint not null default 0
);

insert into public.id_counters (key, value) values
  ('issnum_CivilIssues', 0),
  ('issnum_ElectricIssues', 0),
  ('issnum_FireIssues', 0),
  ('issnum_HseInspections', 0),
  ('jobnum_ElectricalJobs', 0),
  ('frnum_ElectricWorkerReports', 0),
  ('asanum_AsaasItems', 0)
on conflict (key) do nothing;

-- Atomic never-reuse counter (used by Edge Function)
create or replace function public.next_id_counter(p_key text)
returns bigint
language plpgsql
security definer
as $$
declare
  v bigint;
begin
  insert into public.id_counters(key, value) values (p_key, 1)
  on conflict (key) do update set value = public.id_counters.value + 1
  returning value into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: deny browser/anon direct access; Edge Function uses service role
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.cleaning_reports enable row level security;
alter table public.tasks enable row level security;
alter table public.task_photos enable row level security;
alter table public.week_coverage enable row level security;
alter table public.task_log enable row level security;
alter table public.civil_issues enable row level security;
alter table public.electric_issues enable row level security;
alter table public.fire_issues enable row level security;
alter table public.hse_inspections enable row level security;
alter table public.civil_jobs enable row level security;
alter table public.electrical_jobs enable row level security;
alter table public.civil_summaries enable row level security;
alter table public.electrical_summaries enable row level security;
alter table public.electric_worker_reports enable row level security;
alter table public.asaas_items enable row level security;
alter table public.application_checks enable row level security;
alter table public.application_check_history enable row level security;
alter table public.trash enable row level security;
alter table public.worker_locations enable row level security;
alter table public.worker_push_tokens enable row level security;
alter table public.ui_settings enable row level security;
alter table public.photo_migration_log enable row level security;
alter table public.id_counters enable row level security;

-- No policies for anon/authenticated ⇒ no access via public API key.
-- service_role bypasses RLS.

commit;
