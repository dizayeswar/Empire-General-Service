-- EGS UPS monthly inspections, change history, and full unit register

begin;

alter table public.ups_checks add column if not exists notes text not null default '';
alter table public.ups_checks add column if not exists last_inspected_month text not null default '';
alter table public.ups_checks add column if not exists last_inspected_at text not null default '';
alter table public.ups_checks add column if not exists last_inspected_by text not null default '';

create table if not exists public.ups_check_history (
  id text primary key,
  check_id text not null references public.ups_checks(id) on delete cascade,
  field text not null default '',
  old_value text not null default '',
  new_value text not null default '',
  inspection_month text not null default '',
  changed_at text not null default '',
  changed_by text not null default ''
);
create index if not exists ups_check_history_check_idx on public.ups_check_history(check_id);
create index if not exists ups_check_history_changed_idx on public.ups_check_history(changed_at);

create table if not exists public.ups_inspections (
  id text primary key,
  unit_id text not null references public.ups_checks(id) on delete cascade,
  month text not null,
  ups_status text not null default '',
  battery_status text not null default '',
  room_clean text not null default '',
  ac_status text not null default '',
  alarm_fault text not null default '',
  notes text not null default '',
  inspected_at text not null default '',
  inspected_by text not null default '',
  unique (unit_id, month)
);
create index if not exists ups_inspections_month_idx on public.ups_inspections(month);
create index if not exists ups_inspections_unit_idx on public.ups_inspections(unit_id);

alter table public.ups_check_history enable row level security;
alter table public.ups_inspections enable row level security;

insert into public.ups_checks (
  id, ups_group, no, apartment, floor, room, kks, brand, capacity,
  ups_status, battery_status, room_clean, ac_status, alarm_fault, notes,
  updated_at, updated_by
) values
  ('ups-w1-ea', 'wing1', 1, 'W1', 'Roof', 'E&M', 'E-A', 'Riello', '40 KVA', 'Normal', 'Normal', 'No', 'Good', '', '', '', ''),
  ('ups-w2-ea', 'wing1', 2, 'W2', 'Roof', 'E&M', 'E-A', 'Riello', '40 KVA', 'Normal', 'Normal', 'No', 'Good', '', '', '', ''),
  ('ups-w3-ea', 'wing1', 3, 'W3', 'Roof', 'E&M', 'E-A', 'Riello', '40 KVA', 'Normal', 'Normal', 'No', 'Faulty', '', '', '', ''),
  ('ups-w4-ea', 'wing1', 4, 'W4', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w5-ea', 'wing1', 5, 'W5', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w6-ea', 'wing1', 6, 'W6', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w7-ea', 'wing1', 7, 'W7', 'Roof', 'E&M', 'E-A', 'Riello', '60 KVA', 'Normal', 'Faulty', 'No', 'Good', 'Resistor should be replaced', '', '', ''),
  ('ups-w8-ea', 'wing1', 8, 'W8', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w9-ea', 'wing1', 9, 'W9', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w10-ea', 'wing1', 10, 'W10', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w11-ea', 'wing1', 11, 'W11', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w12-ea', 'wing2', 12, 'W12', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w13-ea', 'wing2', 13, 'W13', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w14-ea', 'wing2', 14, 'W14', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-w15-ea', 'wing2', 15, 'W15', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-es1-ea', 'square', 1, 'ES1', 'Roof', 'E&M', 'E-A', 'Inform', '80 KVA', 'Normal', 'Normal', 'Yes', 'Poor', '', '', '', ''),
  ('ups-es2-ea', 'square', 2, 'ES2', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-es3-ea', 'square', 3, 'ES3', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-es4-ea', 'square', 4, 'ES4', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-es5-ea', 'square', 5, 'ES5', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-es6-ea', 'square', 6, 'ES6', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-wda-ea', 'diamond', 1, 'WD-A', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-wdb-ea', 'diamond', 2, 'WD-B', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-wdc-ea', 'diamond', 3, 'WD-C', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-tower-ea', 'tower', 1, 'Tower', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-c1-ea', 'complex', 1, 'C1', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-c2-ea', 'complex', 2, 'C2', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', ''),
  ('ups-c3-ea', 'complex', 3, 'C3', 'Roof', 'E&M', 'E-A', '', '', '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

commit;
