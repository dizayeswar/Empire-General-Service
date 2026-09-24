-- EGS — charging bot switch read
-- Laptop watch reads enabled over REST. Off still stops everything.

begin;

grant select on public.charging_bot_state to anon, authenticated;

drop policy if exists charging_bot_state_read on public.charging_bot_state;
create policy charging_bot_state_read
  on public.charging_bot_state
  for select
  to anon, authenticated
  using (true);

commit;
