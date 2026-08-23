-- Grant dizayeswar UPS module access (merge into existing module_access JSON)
update public.users
set
  module_access = coalesce(module_access, '{}'::jsonb) || '{"ups":"write"}'::jsonb,
  updated_at = now()
where username = 'dizayeswar';
