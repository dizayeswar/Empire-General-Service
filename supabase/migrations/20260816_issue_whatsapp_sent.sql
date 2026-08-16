-- EGS — issue WhatsApp sent (shared yellow cards)
-- Run in Supabase SQL Editor, then save as: EGS — issue WhatsApp sent

alter table public.civil_issues
  add column if not exists whatsapp_sent_at text not null default '',
  add column if not exists whatsapp_sent_by text not null default '';

alter table public.electric_issues
  add column if not exists whatsapp_sent_at text not null default '',
  add column if not exists whatsapp_sent_by text not null default '';

alter table public.fire_issues
  add column if not exists whatsapp_sent_at text not null default '',
  add column if not exists whatsapp_sent_by text not null default '';
