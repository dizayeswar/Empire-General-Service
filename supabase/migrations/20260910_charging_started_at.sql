-- EGS — charging started_at
-- Query name in SQL Editor: EGS — charging started_at

alter table public.charging_requests
  add column if not exists started_at timestamptz;
