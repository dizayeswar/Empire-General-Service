-- Which HR-F-06 box this account's e-signature fills.
-- emp = Employee, line = Line Manager, director = Director, hr = HR.

alter table public.users
  add column if not exists signature_role text not null default '';

comment on column public.users.signature_role is
  'HR paper box for this account stamp: emp, line, director, hr, or blank.';
