-- EGS — E2 / E3 companies
-- One system, two companies. Everything that exists today is E2.
-- users.companies: which company an account may open ("E2", "E3" or "E2,E3"). Admins always get both.
-- HR leave papers and the HR change log now belong to one company each.
-- Charging (Bobby) tables are NOT touched.

begin;

alter table public.users
  add column if not exists companies text not null default 'E2';

alter table public.hr_leave_requests
  add column if not exists company text not null default 'E2';
create index if not exists hr_leave_requests_company_idx on public.hr_leave_requests(company);

alter table public.hr_employee_changes
  add column if not exists company text not null default 'E2';
create index if not exists hr_employee_changes_company_idx on public.hr_employee_changes(company);

-- HR list for one company. Old callers (no argument) still get E2.
drop function if exists public.list_hr_leave_slim();
create or replace function public.list_hr_leave_slim(p_company text default 'E2')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'num', r.num,
    'company', r.company,
    'emp_name', r.emp_name,
    'emp_department', r.emp_department,
    'emp_code', r.emp_code,
    'emp_division', r.emp_division,
    'emp_job_title', r.emp_job_title,
    'replacement', r.replacement,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'days_out', r.days_out,
    'leave_type', r.leave_type,
    'leave_other', r.leave_other,
    'emp_signed_at', r.emp_signed_at,
    'line_manager_name', r.line_manager_name,
    'line_manager_signed_at', r.line_manager_signed_at,
    'line_manager_status', r.line_manager_status,
    'director_name', r.director_name,
    'director_signed_at', r.director_signed_at,
    'director_status', r.director_status,
    'hr_comment', r.hr_comment,
    'hr_signed_at', r.hr_signed_at,
    'status', r.status,
    'created_by', r.created_by,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'entitlements', coalesce(r.entitlements_slim, public.hr_leave_slim_ents(r.entitlements))
  )), '[]'::jsonb)
  from public.hr_leave_requests r
  where r.company = coalesce(nullif(upper(btrim(p_company)), ''), 'E2');
$$;

revoke all on function public.list_hr_leave_slim(text) from public, anon, authenticated;
grant execute on function public.list_hr_leave_slim(text) to service_role;

commit;
