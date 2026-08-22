-- EGS — Warehouse Invoices (Receipt vouchers)
-- Run in Supabase SQL Editor (query name: EGS — warehouse invoices table)

create table if not exists public.warehouse_invoices (
  id text primary key,
  num bigint,
  invoice_no text not null default '',
  invoice_date text not null default '',
  company text not null default '',
  name text not null default '',
  property_code text not null default '',
  amount_usd text not null default '',
  amount_iqd text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_invoices_created_at_idx
  on public.warehouse_invoices (created_at desc);

create index if not exists warehouse_invoices_invoice_date_idx
  on public.warehouse_invoices (invoice_date desc);

alter table public.warehouse_invoices enable row level security;

insert into public.id_counters (key, value)
values ('whinv_WarehouseInvoices', 0)
on conflict (key) do nothing;
