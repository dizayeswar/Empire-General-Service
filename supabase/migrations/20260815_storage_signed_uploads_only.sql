-- Harden empire-photos: remove anonymous upload/update (uploads go through signed URLs via empire-api).
-- Keep public READ so dashboards and phones can still open photo links.

drop policy if exists "Anon upload empire photos" on storage.objects;
drop policy if exists "Anon update empire photos" on storage.objects;

-- Ensure public read remains (safe to re-run)
drop policy if exists "Public read empire photos" on storage.objects;
create policy "Public read empire photos"
on storage.objects for select
to public
using ( bucket_id = 'empire-photos' );
