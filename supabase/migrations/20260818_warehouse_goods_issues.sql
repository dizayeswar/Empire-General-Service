-- EGS — Warehouse Goods Issue Notes
-- Run in Supabase SQL Editor (query name: EGS — warehouse goods issues table)

create table if not exists public.warehouse_goods_issues (
  id text primary key,
  num bigint,
  request_no text not null default '',
  request_date text not null default '',
  requester text not null default '',
  company text not null default '',
  issue_type text not null default '',
  property_code text not null default '',
  store_keeper text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_goods_issues_created_at_idx
  on public.warehouse_goods_issues (created_at desc);

create index if not exists warehouse_goods_issues_request_date_idx
  on public.warehouse_goods_issues (request_date desc);

alter table public.warehouse_goods_issues enable row level security;

insert into public.id_counters (key, value)
values ('whgin_WarehouseGoodsIssues', 0)
on conflict (key) do nothing;
