-- EGS — UPS monthly checklist register

begin;

create table if not exists public.ups_checks (
  id text primary key,
  ups_group text not null default '',
  no integer not null default 0,
  apartment text not null default '',
  floor text not null default '',
  room text not null default '',
  kks text not null default '',
  brand text not null default '',
  capacity text not null default '',
  ups_status text not null default '',
  battery_status text not null default '',
  room_clean text not null default '',
  ac_status text not null default '',
  alarm_fault text not null default '',
  updated_at text not null default '',
  updated_by text not null default ''
);

create index if not exists ups_checks_group_idx on public.ups_checks(ups_group);
create index if not exists ups_checks_apartment_idx on public.ups_checks(apartment);

insert into public.ups_checks (
  id, ups_group, no, apartment, floor, room, kks, brand, capacity,
  ups_status, battery_status, room_clean, ac_status, alarm_fault, updated_at, updated_by
) values
  ('ups-w1-ea', 'wing1', 1, 'W1', 'Roof', 'E&M', 'E-A', 'Riello', '40 KVA', 'Normal', 'Normal', 'No', 'Good', '', '', ''),
  ('ups-w2-ea', 'wing1', 2, 'W2', 'Roof', 'E&M', 'E-A', 'Riello', '40 KVA', 'Normal', 'Normal', 'No', 'Good', '', '', ''),
  ('ups-w3-ea', 'wing1', 3, 'W3', 'Roof', 'E&M', 'E-A', 'Riello', '40 KVA', 'Normal', 'Normal', 'No', 'Faulty', '', '', ''),
  ('ups-w7-ea', 'wing1', 7, 'W7', 'Roof', 'E&M', 'E-A', 'Riello', '60 KVA', 'Normal', 'Faulty', 'No', 'Good', 'Resistor should be replaced', '', ''),
  ('ups-es1-ea', 'square', 1, 'ES1', 'Roof', 'E&M', 'E-A', 'Inform', '80 KVA', 'Normal', 'Normal', 'Yes', 'Poor', '', '', '')
on conflict (id) do nothing;

alter table public.ups_checks enable row level security;

commit;
