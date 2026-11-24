-- EGS — Send Task Electrical issues (2026-11-24)
-- Replaces the Electrical "issues found" list on Send Task with the 9 the user gave.
-- Old types are switched off (active = false), not deleted, so tasks already sent keep their issue names.
-- "Other" stays last so a sender can still write an issue that is not on the list.

update public.dept_issue_types
   set active = false
 where dept = 'electrical'
   and code not in ('other');

insert into public.dept_issue_types (dept, code, label, sort_order, active) values
  ('electrical', 'tripped_breaker',  'The circuit breaker has tripped.', 1, true),
  ('electrical', 'meter_error_77',   'The meter is not accepting the card (Error 77).', 2, true),
  ('electrical', 'water_heater',     'The water heater is not heating the water.', 3, true),
  ('electrical', 'bulb_replacement', 'Light bulb replacement.', 4, true),
  ('electrical', 'chandelier',       'Chandelier installation.', 5, true),
  ('electrical', 'check_balance',    'Checking the electricity balance.', 6, true),
  ('electrical', 'add_socket',       'Adding a power socket.', 7, true),
  ('electrical', 'partial_power',    'Part of the house has electricity, and part does not.', 8, true),
  ('electrical', 'high_consumption', 'High electricity consumption (the card runs out quickly).', 9, true),
  ('electrical', 'other',            'Other', 100, true)
on conflict (dept, code) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      active = true;

-- Check: should list the 9 new issues and Other.
select code, label, sort_order
  from public.dept_issue_types
 where dept = 'electrical' and active
 order by sort_order;
