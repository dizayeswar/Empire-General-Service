-- EGS — portal sync requests
-- Query name in SQL Editor: EGS — portal sync requests
--
-- Application → Sync to portal: a person sends Unit Code + phone, the invite bot on the
-- office PC (invite-bot/website_bot.py) updates SAP and sends the portal invitation, and
-- writes its progress back here. New tables only — nothing else is changed.

begin;

create table if not exists public.portal_sync_requests (
  id text primary key,
  unit_code text not null,
  phone text not null,
  -- waiting → sap → sap_done → portal → done | failed | cancelled
  status text not null default 'waiting',
  result text not null default '',        -- invited / already activated / already invited
  message text not null default '',       -- last progress or problem text from the bot
  created_by text not null default '',
  cancelled_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists portal_sync_requests_status_idx
  on public.portal_sync_requests (status);

create index if not exists portal_sync_requests_created_at_idx
  on public.portal_sync_requests (created_at desc);

-- One row: when the bot last asked for work (the "Bot online" light on the page).
create table if not exists public.portal_sync_bot_state (
  id text primary key,
  last_seen timestamptz,
  note text not null default ''
);

alter table public.portal_sync_requests enable row level security;
alter table public.portal_sync_bot_state enable row level security;

commit;
