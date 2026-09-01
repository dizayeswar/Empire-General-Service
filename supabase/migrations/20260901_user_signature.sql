-- E-signature stored on the user (HR Director stamp).

alter table public.users
  add column if not exists signature text not null default '';

comment on column public.users.signature is
  'PNG/JPG data URL used as this user''s e-signature (HR Director confirm).';
