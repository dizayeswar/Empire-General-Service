# ImgBB → Supabase migration guide (Empire World EGS)

This guide moves **all EGS photos** from ImgBB to **Supabase Storage**, updates the website to upload new photos to Supabase, and rewrites existing photo URLs in your Google Sheet.

**Do the steps in order.** Skipping setup or migrating before deploying the new frontend can break uploads.

---

## What changes

| Before | After |
|--------|--------|
| Photos uploaded to ImgBB from the browser | Photos uploaded to Supabase Storage |
| ImgBB URL saved in Google Sheet | Supabase public URL saved in Google Sheet |
| Third-party image host | Your own Supabase project |

Reports, issues, jobs, task photos, fixed photos, worker completion photos, and recycle-bin rows are all covered.

---

## Step 1 — Create Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. **New project** → name it e.g. `empire-egs`.
3. Choose a region close to Iraq (e.g. Frankfurt or Mumbai).
4. Save your **database password** somewhere safe.

When the project is ready, open **Project Settings → API** and note:

- **Project URL** — e.g. `https://abcdefgh.supabase.co`
- **anon public** key — safe for the website (`config.js`)
- **service_role** key — **backend only** (Google Apps Script Script Properties). Never commit this or put it in GitHub.

---

## Step 2 — Create storage bucket

1. In Supabase: **Storage → New bucket**
2. Name: `empire-photos`
3. Enable **Public bucket** (photos must load in dashboards without login)

### Storage policies (SQL Editor)

Run this in **SQL Editor → New query**:

```sql
-- Public read
create policy "Public read empire photos"
on storage.objects for select
to public
using ( bucket_id = 'empire-photos' );

-- Website uploads (anon key in config.js)
create policy "Anon upload empire photos"
on storage.objects for insert
to anon
with check (
  bucket_id = 'empire-photos'
  and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
);

-- Allow upsert overwrite during migration retries
create policy "Anon update empire photos"
on storage.objects for update
to anon
using ( bucket_id = 'empire-photos' )
with check ( bucket_id = 'empire-photos' );
```

If policies already exist, adjust names or drop duplicates first.

---

## Step 3 — Configure the website (`config.js`)

Edit `config.js` on your machine and fill in:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_PUBLIC_KEY',
  bucket: 'empire-photos'
};
```

Push to GitHub `main` so GitHub Pages gets the update.

**Test a new upload** after deploy (Step 6) — do not run bulk migration until this works.

---

## Step 4 — Configure Google Apps Script (for bulk migration)

The bulk migrator runs in Apps Script with the **service role** key so it can copy thousands of old ImgBB files safely.

1. Open your Apps Script project (same one as `empire-all-in-one.gs`).
2. Paste the latest `empire-all-in-one.gs` from this repo.
3. **Project settings → Script properties** → add:

| Property | Value |
|----------|--------|
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_SERVICE_KEY` | your **service_role** key |
| `SUPABASE_BUCKET` | `empire-photos` (optional) |

4. **Do not deploy** a new web app version yet unless you also changed API actions — migration functions run from the editor only.

---

## Step 5 — Migrate existing ImgBB photos (Google Sheet)

The function `migrateImgbbBatch` scans these sheets:

- `Reports`, `TaskPhotos`, `WeekCoverage`
- `CivilIssues`, `ElectricIssues`, `FireIssues`, `HseInspections`
- `CivilJobs`, `ElectricalJobs`
- `Trash` (recycle bin JSON)

For each ImgBB URL it:

1. Downloads the image from ImgBB  
2. Uploads to Supabase under `migrated/...`  
3. Updates the cell in Google Sheets  
4. Logs old → new URL in sheet **`PhotoMigrationLog`**

### Run migration

1. Apps Script editor → select function **`countImgbbPhotosRemaining`** → Run  
   - Authorize if prompted.  
   - Check **Execution log** — shows how many cells still contain ImgBB URLs.

2. Run **`migrateImgbbBatch`** with parameter `20` (migrates up to 20 cells per run).

3. Repeat **`migrateImgbbBatch(20)`** until `remaining` is `0`.

**Tips:**

- Run batches of 15–25 to stay under the 6-minute Apps Script limit.
- If a batch reports `errors`, fix network/ImgBB issues and run again — completed rows are skipped via `PhotoMigrationLog`.
- Old ImgBB links keep working until each row is migrated; you can migrate over several days.
- After migration, spot-check photos in Civil Issues, Cleaning dashboard, and Jobs.

### Verify remaining count

```text
countImgbbPhotosRemaining()  →  { remaining: 0 }
```

---

## Step 6 — Deploy everything

### Frontend (GitHub Pages)

1. Commit and push all changes (`config.js`, `assets/empire-storage.js`, updated HTML/JS).
2. Wait 1–3 minutes for GitHub Pages.
3. Hard refresh the live site (Ctrl+F5).

### Backend (only if you changed `empire-all-in-one.gs`)

1. Copy full `empire-all-in-one.gs` into Apps Script.
2. **Deploy → Manage deployments → Edit → New version → Deploy**.

### Smoke test checklist

- [ ] Upload a photo on **Civil Issue** → URL contains your Supabase domain  
- [ ] Upload on **Cleaning dashboard** (report + task photo)  
- [ ] Upload on **Civil department** job  
- [ ] Open an **old issue** migrated from ImgBB → photo still visible  
- [ ] Worker fix photo on phone (if used)

---

## Folder layout in Supabase

New uploads:

```text
empire-photos/
  issues/civil-issue/2026-07/uuid.jpg
  issues/electric-issue/...
  cleaning/reports/...
  cleaning/tasks/...
  jobs/civil/...
  jobs/electrical/...
  hse/inspections/...
```

Migrated old photos:

```text
empire-photos/migrated/issues/civil/uuid.jpg
```

---

## Troubleshooting

### “Supabase is not configured in config.js”

Fill in `SUPABASE_CONFIG.url` and `SUPABASE_CONFIG.anonKey`, push to GitHub, hard refresh.

### Upload fails with 401 / 403

- Check storage policies (Step 2).  
- Confirm bucket name is `empire-photos` and bucket is **public**.

### Migration: “Set SUPABASE_URL and SUPABASE_SERVICE_KEY”

Add Script Properties in Step 4.

### Migration: “Download failed” for some URLs

That ImgBB link may be dead or rate-limited. Note the URL from the error, open it in a browser, retry later, or re-upload manually for that record.

### Photos broken after migration

1. Open **`PhotoMigrationLog`** sheet — find `oldUrl` / `newUrl`.  
2. Open `newUrl` in browser — if 404, re-run migration for that row.  
3. Clear browser cache / hard refresh.

---

## Security notes

- **anon key** in `config.js` is public (same as ImgBB key was). Storage policies limit what it can do.  
- **service_role key** stays in Apps Script Script Properties only.  
- Do not put the service role key in GitHub, `config.js`, or chat.

---

## Optional — after migration is complete

- Remove old ImgBB API key references (already removed from code).  
- Monitor Supabase **Storage → Usage** (free tier ≈ 1 GB).  
- Keep **`PhotoMigrationLog`** for audit; do not delete until you are satisfied.

---

## Quick reference

| Task | Where |
|------|--------|
| New photo uploads | Supabase via `assets/empire-storage.js` |
| Sheet data | Google Sheets (unchanged) |
| Bulk copy old photos | Apps Script `migrateImgbbBatch(n)` |
| Migration audit | Sheet tab `PhotoMigrationLog` |
| Live site config | `config.js` → `SUPABASE_CONFIG` |

See also **[DEPLOY.md](DEPLOY.md)** for general EGS deployment.
