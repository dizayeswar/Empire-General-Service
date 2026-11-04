-- EGS — HR leave list: store the slim copy once per paper
-- Run AFTER 20261104_hr_leave_list_slim.sql.
-- Each paper keeps a small copy of its entitlements (signatures as "1" flags) in
-- entitlements_slim. A trigger refreshes it whenever the paper is saved, so the
-- HR list never has to open the signature images again, however many papers there are.

begin;

alter table public.hr_leave_requests
  add column if not exists entitlements_slim jsonb;

create or replace function public.hr_leave_set_slim()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.entitlements is distinct from old.entitlements or new.entitlements_slim is null then
    new.entitlements_slim := public.hr_leave_slim_ents(new.entitlements);
  end if;
  return new;
end;
$$;

drop trigger if exists hr_leave_set_slim on public.hr_leave_requests;
create trigger hr_leave_set_slim
  before insert or update on public.hr_leave_requests
  for each row execute function public.hr_leave_set_slim();

-- Fill the copy for papers that already exist.
update public.hr_leave_requests
   set entitlements_slim = public.hr_leave_slim_ents(entitlements)
 where entitlements_slim is null;

-- List only the columns the HR tabs use; never touch the image columns.
create or replace function public.list_hr_leave_slim()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'num', r.num,
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
  from public.hr_leave_requests r;
$$;

revoke all on function public.list_hr_leave_slim() from public, anon, authenticated;
grant execute on function public.list_hr_leave_slim() to service_role;

commit;
