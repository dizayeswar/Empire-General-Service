-- EGS — dept tasks schema
-- Department Tasks: a sender picks an apartment + issues and sends a task to a department
-- (Electrical first). Workers accept and complete on the phone. Every step is an event row.

begin;

create table if not exists public.dept_locations (
  id text primary key default gen_random_uuid()::text,
  project text not null default '',
  building text not null default '',
  floor text not null default '',
  unit text not null default '',
  label text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists dept_locations_uniq on public.dept_locations(project, building, floor, unit);
create index if not exists dept_locations_building_idx on public.dept_locations(building);

create table if not exists public.dept_issue_types (
  id text primary key default gen_random_uuid()::text,
  dept text not null,
  code text not null,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists dept_issue_types_uniq on public.dept_issue_types(dept, code);

create table if not exists public.dept_tasks (
  id text primary key,
  num bigint not null default 0,
  dept text not null,
  location_id text not null default '',
  project text not null default '',
  building text not null default '',
  floor text not null default '',
  unit text not null default '',
  status text not null default 'open',
  priority text not null default 'normal',
  note text not null default '',
  created_by text not null default '',
  assigned_to text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists dept_tasks_dept_status_idx on public.dept_tasks(dept, status);
create index if not exists dept_tasks_assigned_idx on public.dept_tasks(assigned_to);
create index if not exists dept_tasks_created_idx on public.dept_tasks(created_at desc);

create table if not exists public.dept_task_items (
  id text primary key default gen_random_uuid()::text,
  task_id text not null references public.dept_tasks(id) on delete cascade,
  issue_type_id text not null default '',
  issue_label text not null default '',
  note text not null default '',
  status text not null default 'pending',
  worker_note text not null default '',
  completed_by text not null default '',
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists dept_task_items_task_idx on public.dept_task_items(task_id);

create table if not exists public.dept_task_events (
  id bigint generated always as identity primary key,
  task_id text not null references public.dept_tasks(id) on delete cascade,
  item_id text not null default '',
  actor text not null default '',
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dept_task_events_task_idx on public.dept_task_events(task_id, created_at);
create index if not exists dept_task_events_actor_idx on public.dept_task_events(actor, created_at desc);

create table if not exists public.dept_task_photos (
  id text primary key default gen_random_uuid()::text,
  task_id text not null references public.dept_tasks(id) on delete cascade,
  item_id text not null default '',
  kind text not null default 'after',
  url text not null,
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists dept_task_photos_task_idx on public.dept_task_photos(task_id);

insert into public.id_counters (key, value) values ('dtnum_DeptTasks', 0)
on conflict (key) do nothing;

-- Locations: one row per building floor, from the floors map used by the issue pages.
with src as (select '{"ec":{"EC1":["Ground","F1","F2","F3","F4","F5"],"EC2":["Ground","F1","F2","F3","F4","F5"],"EC3":["Ground","F1","F2","F3","F4","F5"],"EC4":["B1","Ground","F1","F2","F3","F4","F5"],"EC5":["B1","Ground","F1","F2","F3","F4","F5"],"EC6":["B1","Ground","F1","F2","F3","F4","F5"]},"es":{"ES1":["B1","B2","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20"],"ES2":["B1","B2","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20"],"ES3":["B1","B2","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20"],"ES4":["B1","B2","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20"],"ES6":["B1","B2","B3","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24"]},"wd":{"WD-A":["B1","B2","R","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21"],"WD-B":["B1","B2","R","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23"],"WD-C":["B1","B2","R","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21"]},"ww":{"WW1":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8"],"WW2":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10"],"WW3":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"],"WW4":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14"],"WW5":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16"],"WW6":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18"],"WW7":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20"],"WW8":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22"],"WW9":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24"],"WW10":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","F25","F26"],"WW11":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","F25","F26"],"WW12":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","F25","F26","F27","F28","F29","F30"],"WW13":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","F25","F26","F27","F28","F29","F30"],"WW14":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","F25","F26","F27","F28","F29","F30"],"WW15":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","F25","F26","F27","F28","F29","F30"]},"ra":{"RA-A1":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A2":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A3":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A4":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A5":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A6":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A7":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A8":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A9":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A10":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A11":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-A12":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B1":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B2":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B3":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B4":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B5":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B6":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B7":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B8":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B9":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B10":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B11":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-B12":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9"],"RA-C1":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"],"RA-C2":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"],"RA-C3":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"],"RA-C4":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"],"RA-C5":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"],"RA-C6":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"],"RA-C7":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"],"RA-C8":["B1","Ground","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"]}}'::jsonb as j)
insert into public.dept_locations (project, building, floor, unit, label, sort_order)
select p.key, b.key, f.value #>> '{}', '', b.key || ' ' || (f.value #>> '{}'), f.ord::int
from src,
  jsonb_each(src.j) as p,
  jsonb_each(p.value) as b,
  jsonb_array_elements(b.value) with ordinality as f(value, ord)
on conflict (project, building, floor, unit) do nothing;

insert into public.dept_issue_types (dept, code, label, sort_order) values
  ('electrical', 'power_outage', 'Power outage', 1),
  ('electrical', 'broken_light', 'Broken light', 2),
  ('electrical', 'flickering_light', 'Flickering light', 3),
  ('electrical', 'faulty_socket', 'Faulty socket / outlet', 4),
  ('electrical', 'broken_switch', 'Broken switch', 5),
  ('electrical', 'exposed_wire', 'Exposed / loose wire', 6),
  ('electrical', 'tripped_breaker', 'Tripped breaker', 7),
  ('electrical', 'burnt_smell', 'Burnt smell', 8),
  ('electrical', 'no_power_area', 'No power in area', 9),
  ('electrical', 'generator', 'Generator issue', 10),
  ('electrical', 'distribution_panel', 'Distribution panel issue', 11),
  ('electrical', 'other', 'Other', 99)
on conflict (dept, code) do nothing;

alter table public.dept_locations enable row level security;
alter table public.dept_issue_types enable row level security;
alter table public.dept_tasks enable row level security;
alter table public.dept_task_items enable row level security;
alter table public.dept_task_events enable row level security;
alter table public.dept_task_photos enable row level security;

commit;
