-- EGS — send task refundable voice
-- Send Task: refundable flag (needs an invoice photo), final "closed" step, and voice messages.
-- Voice messages are for talking only; they are kept out of the task history and reports.

begin;

alter table public.dept_tasks add column if not exists refundable boolean not null default false;
alter table public.dept_tasks add column if not exists closed_at timestamptz;

create table if not exists public.dept_task_voice (
  id text primary key default gen_random_uuid()::text,
  task_id text not null references public.dept_tasks(id) on delete cascade,
  url text not null,
  duration_sec int not null default 0,
  sent_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists dept_task_voice_task_idx on public.dept_task_voice(task_id, created_at);

alter table public.dept_task_voice enable row level security;

commit;
