-- EGS — warehouse signer sections per user
-- Lets an electrical (or other) account also open Warehouse and sign only
-- Assigned Done notes, for chosen signature slots: auth / issued / received.

alter table public.users
  add column if not exists warehouse_sig_sections text not null default '';

comment on column public.users.warehouse_sig_sections is
  'Comma-separated: auth, issued, received. Empty = not a warehouse signer (warehouse_receiver role still defaults to received).';
