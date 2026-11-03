-- EGS — HR employee change log
-- Every change to the HR Employees list (add, edit, remove, days left going up or down from a
-- leave paper) is kept here with who did it and the before/after of each field. Admin Report reads it.

begin;

create table if not exists public.hr_employee_changes (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  by_user text not null default '',          -- account that made the change
  action text not null default '',           -- added / edited / removed / days
  emp_code text not null default '',
  emp_name text not null default '',
  changes jsonb not null default '[]'::jsonb, -- [{ field, from, to }]
  note text not null default ''              -- e.g. "Director confirmed paper #120"
);
create index if not exists hr_employee_changes_created_idx on public.hr_employee_changes(created_at desc);
create index if not exists hr_employee_changes_code_idx on public.hr_employee_changes(emp_code);

alter table public.hr_employee_changes enable row level security;

commit;
