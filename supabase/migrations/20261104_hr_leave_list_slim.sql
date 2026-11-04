-- EGS — HR leave list without signature images
-- The HR list only needs to know WHICH boxes are signed, not the pictures.
-- This builds the list inside Postgres and sends back small rows, so the
-- Leave request tabs stop hitting "statement timeout (57014)".
-- Signatures stay as "1" / "" flags; the full paper still loads on View / Print.

begin;

create or replace function public.hr_leave_slim_ents(p_raw text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  j jsonb;
  sigs jsonb;
  scan jsonb;
  slim jsonb;
  emp text;
  line text;
begin
  begin
    if btrim(coalesce(p_raw, '')) = '' then
      j := '{}'::jsonb;
    else
      j := p_raw::jsonb;
    end if;
  exception when others then
    j := '{}'::jsonb;
  end;
  if jsonb_typeof(j) is distinct from 'object' then
    j := '{}'::jsonb;
  end if;

  sigs := case when jsonb_typeof(j -> '__sigs') = 'object' then j -> '__sigs' else '{}'::jsonb end;
  scan := case when jsonb_typeof(j -> '__scan') = 'object' then j -> '__scan' else '{}'::jsonb end;

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into slim
    from jsonb_each(j) e
   where e.key not in ('__sigs', '__scan')
     and not (jsonb_typeof(e.value) = 'string' and length(e.value #>> '{}') > 180);

  emp := btrim(coalesce(sigs ->> 'emp', ''));
  line := btrim(coalesce(sigs ->> 'line', ''));

  slim := slim || jsonb_build_object('__sigs', jsonb_build_object(
    'emp', case when emp <> '' then '1' else '' end,
    'line', case when line <> '' then '1' else '' end,
    'director', case when btrim(coalesce(sigs ->> 'director', '')) <> '' then '1' else '' end,
    'hr', case when btrim(coalesce(sigs ->> 'hr', '')) <> '' then '1' else '' end,
    'sameEmpLine', case when emp <> '' and emp = line then '1' else '' end
  ));

  if btrim(coalesce(scan ->> 'url', '')) <> '' then
    slim := slim || jsonb_build_object('__scan', jsonb_build_object('url', '1'));
  end if;

  return slim;
end;
$$;

create or replace function public.list_hr_leave_slim()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    (to_jsonb(r) - 'entitlements' - 'emp_signature' - 'hr_signature')
      || jsonb_build_object('entitlements', public.hr_leave_slim_ents(r.entitlements))
  ), '[]'::jsonb)
  from public.hr_leave_requests r;
$$;

revoke all on function public.hr_leave_slim_ents(text) from public, anon, authenticated;
grant execute on function public.hr_leave_slim_ents(text) to service_role;
revoke all on function public.list_hr_leave_slim() from public, anon, authenticated;
grant execute on function public.list_hr_leave_slim() to service_role;

commit;
