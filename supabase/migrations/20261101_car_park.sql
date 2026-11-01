-- EGS — car park schema
-- Car Park: every apartment keeps a WhatsApp phone and its car plates. Security reports a wrong
-- parking (photo + plate + type); the apartment gets an automatic WhatsApp warning (1st, 2nd, 3rd…).

begin;

create table if not exists public.carpark_apartments (
  code text primary key,                     -- e.g. RA-A1-G-1 (same as application_checks.property_id)
  project text not null default '',          -- ra / ww / wd / es
  phone text not null default '',            -- WhatsApp number, stored as typed
  owner_name text not null default '',
  note text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists carpark_apartments_project_idx on public.carpark_apartments(project);

create table if not exists public.carpark_cars (
  id text primary key default gen_random_uuid()::text,
  apartment_code text not null references public.carpark_apartments(code) on delete cascade,
  plate text not null,                       -- as typed, e.g. "22 A 12345"
  plate_norm text not null,                  -- letters + digits only, upper case
  created_at timestamptz not null default now()
);
create unique index if not exists carpark_cars_plate_uniq on public.carpark_cars(plate_norm);
create index if not exists carpark_cars_apartment_idx on public.carpark_cars(apartment_code);

create table if not exists public.carpark_reports (
  id text primary key default gen_random_uuid()::text,
  num bigint not null default 0,
  project text not null default '',
  plate text not null default '',
  plate_norm text not null default '',
  apartment_code text not null default '',   -- '' when the plate is not on any apartment
  violation text not null default '',        -- two_spots / blocking
  photo_url text not null default '',
  warning_no int not null default 0,         -- 1st, 2nd, 3rd… for that apartment; 0 = no apartment
  reported_by text not null default '',
  created_at timestamptz not null default now(),
  wa_status text not null default 'pending', -- pending / sent / failed / no_phone / no_apartment / not_configured
  wa_error text not null default '',
  wa_message_id text not null default '',
  wa_sent_at timestamptz,
  wa_tries int not null default 0,
  deleted_at timestamptz,
  deleted_by text not null default ''
);
create index if not exists carpark_reports_created_idx on public.carpark_reports(created_at desc);
create index if not exists carpark_reports_apartment_idx on public.carpark_reports(apartment_code);
create index if not exists carpark_reports_plate_idx on public.carpark_reports(plate_norm);

alter table public.carpark_apartments enable row level security;
alter table public.carpark_cars enable row level security;
alter table public.carpark_reports enable row level security;

-- Start with every apartment already in the Application list (4,199 at setup).
insert into public.carpark_apartments (code, project)
select upper(trim(property_id)), lower(trim(project))
from public.application_checks
where trim(coalesce(property_id, '')) <> ''
on conflict (code) do nothing;

commit;
