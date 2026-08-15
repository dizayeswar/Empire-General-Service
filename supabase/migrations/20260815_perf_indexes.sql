-- Speed indexes for filtered issue/job lists
create index if not exists civil_issues_status_date_idx on public.civil_issues (status, date);
create index if not exists civil_issues_project_status_idx on public.civil_issues (project, status);
create index if not exists electric_issues_status_date_idx on public.electric_issues (status, date);
create index if not exists electric_issues_project_status_idx on public.electric_issues (project, status);
create index if not exists civil_jobs_date_idx on public.civil_jobs (date);
create index if not exists electrical_jobs_date_idx on public.electrical_jobs (date);
