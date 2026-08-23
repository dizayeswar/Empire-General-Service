update public.users
set
  module_access = coalesce(module_access, '{}'::jsonb) || '{"ups":"write","admin":"write"}'::jsonb,
  dept = 'all',
  role = 'admin',
  updated_at = now()
where username = 'dizaye';
