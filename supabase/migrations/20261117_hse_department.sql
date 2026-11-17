-- EGS — HSE department schema
-- The HSE department replaces the old fire-equipment check log (hse_inspections).
--   hse_observations : unsafe conditions found on site, with priority, responsible team, target date, photos
--   hse_events       : incidents, accidents, near misses, false fire alarms, security events
--   hse_months       : once-a-month numbers (workforce, days, hours) and the report text
-- The monthly report (KPIs, man-hours, LTIFR, TRIR) is worked out from these three tables.

begin;

-- Old fire-equipment log: kept as a backup table, nothing is read from it any more.
do $$
begin
  if to_regclass('public.hse_inspections') is not null
     and to_regclass('public.hse_inspections_old_20261117') is null then
    alter table public.hse_inspections rename to hse_inspections_old_20261117;
  end if;
end $$;

create table if not exists public.hse_observations (
  id text primary key default gen_random_uuid()::text,
  num bigint not null default 0,                  -- shown as HSE-001
  building text not null default '',              -- C1…C6, C1–C6, Zone B, Roofs…
  location text not null default '',
  observation text not null default '',
  priority text not null default 'High',          -- High / Medium / Low
  required_action text not null default '',
  responsible text not null default '',
  status text not null default 'open',            -- open / in_progress / closed
  found_on date not null default current_date,
  target_on date,
  closed_on date,
  remarks text not null default '',
  photos jsonb not null default '[]'::jsonb,       -- photo URLs (before)
  closed_photos jsonb not null default '[]'::jsonb,-- photo URLs (after the fix)
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text not null default ''
);
create index if not exists hse_observations_status_idx on public.hse_observations(status);
create index if not exists hse_observations_found_idx on public.hse_observations(found_on);

create table if not exists public.hse_events (
  id text primary key default gen_random_uuid()::text,
  num bigint not null default 0,
  kind text not null default 'incident',          -- false_alarm / incident / accident / near_miss / security
  building text not null default '',
  location text not null default '',
  happened_at timestamptz not null default now(),
  cause text not null default '',
  outcome text not null default '',
  injury boolean not null default false,
  lost_time boolean not null default false,        -- counts as an LTI
  days_lost int not null default 0,
  status text not null default 'open',            -- open / closed
  photos jsonb not null default '[]'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text not null default ''
);
create index if not exists hse_events_happened_idx on public.hse_events(happened_at desc);

create table if not exists public.hse_months (
  month text primary key,                          -- '2026-10'
  workforce int not null default 0,
  working_days int not null default 0,
  hours_per_day int not null default 8,
  overall_status text not null default '',
  summary text not null default '',
  improved text not null default '',               -- one line per item
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.hse_observations enable row level security;
alter table public.hse_events enable row level security;
alter table public.hse_months enable row level security;

commit;
