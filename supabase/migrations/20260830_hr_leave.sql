-- EGS — HR leave requests (HR-F-06)

begin;

create table if not exists public.hr_leave_requests (
  id text primary key,
  num bigint,
  emp_name text not null default '',
  emp_department text not null default '',
  emp_code text not null default '',
  emp_division text not null default '',
  emp_job_title text not null default '',
  replacement text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  days_out text not null default '',
  leave_type text not null default '',
  leave_other text not null default '',
  emp_signature text not null default '',
  emp_signed_at text not null default '',
  line_manager_name text not null default '',
  line_manager_signed_at text not null default '',
  line_manager_status text not null default '',
  director_name text not null default '',
  director_signed_at text not null default '',
  director_status text not null default '',
  entitlements text not null default '',
  hr_comment text not null default '',
  hr_signature text not null default '',
  hr_signed_at text not null default '',
  status text not null default 'submitted',
  created_by text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create index if not exists hr_leave_requests_start_idx on public.hr_leave_requests(start_date);
create index if not exists hr_leave_requests_status_idx on public.hr_leave_requests(status);
create index if not exists hr_leave_requests_dept_idx on public.hr_leave_requests(emp_department);

alter table public.hr_leave_requests enable row level security;

commit;
