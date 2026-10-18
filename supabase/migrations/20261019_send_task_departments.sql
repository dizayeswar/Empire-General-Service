-- EGS — send task departments
-- Send Task: optional visit time on each task, and issue lists for Civil, HVAC and Mechanical.

begin;

alter table public.dept_tasks add column if not exists visit_at timestamptz;
create index if not exists dept_tasks_visit_idx on public.dept_tasks(visit_at);

insert into public.dept_issue_types (dept, code, label, sort_order) values
  ('civil', 'water_leakage', 'Water leakage', 1),
  ('civil', 'broken_tiles', 'Broken tiles', 2),
  ('civil', 'door_broken', 'Door is broken', 3),
  ('civil', 'door_handle', 'Door handle is broken', 4),
  ('civil', 'repaint_wall', 'Wall needs repainting', 5),
  ('civil', 'mold_damp', 'Mold / damp', 6),
  ('civil', 'cracked_wall', 'Cracked wall', 7),
  ('civil', 'plumbing', 'Plumbing / drain blocked', 8),
  ('civil', 'other', 'Other', 99),

  ('hvac', 'ac_not_cooling', 'AC not cooling', 1),
  ('hvac', 'ac_not_heating', 'AC not heating', 2),
  ('hvac', 'ac_leaking', 'AC leaking water', 3),
  ('hvac', 'ac_noise', 'AC noisy', 4),
  ('hvac', 'ac_not_working', 'AC not turning on', 5),
  ('hvac', 'thermostat', 'Remote / thermostat not working', 6),
  ('hvac', 'filter', 'Filter needs cleaning', 7),
  ('hvac', 'bad_smell', 'Bad smell from AC', 8),
  ('hvac', 'ventilation', 'Ventilation / exhaust fan', 9),
  ('hvac', 'other', 'Other', 99),

  ('mechanical', 'water_pump', 'Water pump issue', 1),
  ('mechanical', 'low_pressure', 'Low water pressure', 2),
  ('mechanical', 'no_hot_water', 'No hot water / water heater', 3),
  ('mechanical', 'pipe_valve_leak', 'Pipe / valve leak', 4),
  ('mechanical', 'water_tank', 'Water tank issue', 5),
  ('mechanical', 'elevator', 'Elevator issue', 6),
  ('mechanical', 'generator', 'Generator issue', 7),
  ('mechanical', 'fire_pump', 'Fire pump / sprinkler issue', 8),
  ('mechanical', 'other', 'Other', 99)
on conflict (dept, code) do nothing;

commit;
