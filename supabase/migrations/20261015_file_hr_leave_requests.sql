-- EGS — file leave papers in one database update
-- Sets or clears entitlements.__archive without copying signature images out of Postgres.

begin;

create or replace function public.file_hr_leave_requests(
  p_ids text[],
  p_archive text,
  p_filed_on text,
  p_updated_at text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  j jsonb;
  n integer := 0;
  arch text := lower(btrim(coalesce(p_archive, '')));
  stamp text := nullif(btrim(coalesce(p_updated_at, '')), '');
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_ids) > 500 then
    raise exception 'too_many_ids';
  end if;
  if stamp is null then
    stamp := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  end if;

  for r in
    select id, entitlements
    from public.hr_leave_requests
    where id = any(p_ids)
      and lower(btrim(status)) in ('completed', 'processed', 'director_approved')
  loop
    begin
      if btrim(coalesce(r.entitlements, '')) = '' then
        j := '{}'::jsonb;
      else
        j := r.entitlements::jsonb;
      end if;
    exception when others then
      j := '{}'::jsonb;
    end;

    if arch = '' then
      j := j - '__archive' - '__filedOn';
    else
      j := j || jsonb_build_object('__archive', arch, '__filedOn', left(coalesce(p_filed_on, ''), 10));
    end if;

    update public.hr_leave_requests
      set entitlements = case when j = '{}'::jsonb then '' else j::text end,
          updated_at = stamp
      where id = r.id;
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.file_hr_leave_requests(text[], text, text, text) from public;
revoke all on function public.file_hr_leave_requests(text[], text, text, text) from anon;
revoke all on function public.file_hr_leave_requests(text[], text, text, text) from authenticated;
grant execute on function public.file_hr_leave_requests(text[], text, text, text) to service_role;

commit;
