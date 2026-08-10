-- Job rows need a separate invoice photo (refundable work from field reports).
alter table public.electrical_jobs
  add column if not exists invoice_photo text not null default '';
