-- Replace one apartment's car plates atomically.
-- The Edge Function already validates the input; this function keeps the delete + insert in
-- one transaction so a later insert/conflict error cannot leave the apartment with no plates.

create or replace function public.replace_carpark_plates(p_code text, p_plates jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  conflict_plate text;
  conflict_code text;
begin
  select c.plate, c.apartment_code
    into conflict_plate, conflict_code
  from jsonb_to_recordset(coalesce(p_plates, '[]'::jsonb)) as p(plate text, plate_norm text)
  join public.carpark_cars c
    on c.plate_norm = p.plate_norm
   and c.apartment_code <> p_code
  limit 1;

  if conflict_code is not null then
    return 'Plate ' || conflict_plate || ' is already on apartment ' || conflict_code || '. Remove it there first.';
  end if;

  delete from public.carpark_cars where apartment_code = p_code;

  insert into public.carpark_cars (apartment_code, plate, plate_norm)
  select p_code, p.plate, p.plate_norm
  from jsonb_to_recordset(coalesce(p_plates, '[]'::jsonb)) as p(plate text, plate_norm text);

  return '';
end;
$$;

revoke execute on function public.replace_carpark_plates(text, jsonb) from public;
revoke execute on function public.replace_carpark_plates(text, jsonb) from anon;
revoke execute on function public.replace_carpark_plates(text, jsonb) from authenticated;
grant execute on function public.replace_carpark_plates(text, jsonb) to service_role;
