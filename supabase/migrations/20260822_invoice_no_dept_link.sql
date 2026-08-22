-- Invoice No. on Civil/Electrical field reports + jobs (warehouse CAI/MEP link).

alter table public.civil_worker_reports
  add column if not exists invoice_no text not null default '';

alter table public.electric_worker_reports
  add column if not exists invoice_no text not null default '';

alter table public.civil_jobs
  add column if not exists invoice_no text not null default '';

alter table public.electrical_jobs
  add column if not exists invoice_no text not null default '';

create index if not exists civil_worker_reports_invoice_no_idx
  on public.civil_worker_reports (invoice_no);

create index if not exists electric_worker_reports_invoice_no_idx
  on public.electric_worker_reports (invoice_no);

create index if not exists civil_jobs_invoice_no_idx
  on public.civil_jobs (invoice_no);

create index if not exists electrical_jobs_invoice_no_idx
  on public.electrical_jobs (invoice_no);
