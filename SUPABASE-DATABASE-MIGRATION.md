# Sheets → Supabase database migration (Empire EGS)

Moves **all app data** from the Google Spreadsheet into Postgres on your existing Supabase project (`nobcitpaudeopzfymgzi`), behind Edge Function `empire-api` that keeps the same `{action, token}` API.

Photos stay in Storage bucket `empire-photos`. This is separate from [SUPABASE-MIGRATION.md](SUPABASE-MIGRATION.md) (ImgBB → Storage).

---

## Architecture after cutover

| Before | After |
|--------|--------|
| Browser → Apps Script → Google Sheet | Browser → Edge Function → Postgres |
| Photos → Supabase Storage | Unchanged |
| Users/passwords in sheet (plaintext) | `users.password_hash` (bcrypt) |
| Tokens sheet | `sessions` table |

Production stays on Apps Script until you set `EMPIRE_API_URL` in [`config.js`](config.js).

---

## Phase 1 — Create tables

1. Open Supabase → **SQL Editor**.
2. Paste and run [`supabase/migrations/20260809_empire_schema.sql`](supabase/migrations/20260809_empire_schema.sql).
3. Confirm tables exist under **Table Editor** (`users`, `civil_issues`, …).

RLS is enabled with **no anon policies** — only the service role (Edge Function) can read/write.

---

## Phase 2 — Export + import (copy only)

### Backup
- File → Download → Excel/CSV of the spreadsheet.
- Note the current Apps Script web-app URL (already in `GOOGLE_SCRIPT_URL_LEGACY`).

### Export from Sheets
1. Apps Script editor → add [`scripts/export-all-sheets.gs`](scripts/export-all-sheets.gs) (needs `SHEET_ID` from `empire-all-in-one.gs`).
2. Run `exportAllSheetsToDrive_()`.
3. Download `export.json` from the Drive folder into `migration-data/export.json` (gitignored).

### Import into Supabase
```bash
cd scripts
npm install
set SUPABASE_URL=https://nobcitpaudeopzfymgzi.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
node import-to-supabase.mjs
```

- Passwords are **bcrypt-hashed** (plaintext never stored in Postgres).
- Old Tokens are **not** imported — everyone logs in again after cutover.
- Review `migration-data/import-report.json` (sheet vs DB counts).

Live site remains on Apps Script during this phase.

---

## Phase 3 — Deploy Edge Function

Install [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref nobcitpaudeopzfymgzi
supabase secrets set RESET_PASSWORD=empire2026
supabase functions deploy empire-api --no-verify-jwt
```

Function URL:
`https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api`

Secrets used:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (auto-injected on hosted Functions)
- `RESET_PASSWORD` (same as Apps Script clear-data password)

Push notifications (`sendCleaningReminder`, assign FCM) are stubbed `{sent:0}` in v1 — core CRUD works without FCM.

---

## Phase 4 — Staging parity

1. Locally set in `config.js`:
   ```js
   const EMPIRE_API_URL = 'https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api';
   ```
2. Do **not** push to GitHub Pages yet.
3. Walk [`scripts/staging-parity-checklist.md`](scripts/staging-parity-checklist.md).
4. Optional smoke:
   ```bash
   set EMPIRE_API_URL=https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api
   set SMOKE_USER=your_admin
   set SMOKE_PASS=your_password
   node scripts/smoke-api.mjs
   ```

---

## Phase 5 — Safe cutover

1. Announce a short maintenance window.
2. Redeploy Apps Script with `FREEZE_WRITES = true` in [`empire-all-in-one.gs`](empire-all-in-one.gs) (reads/login still work; mutations blocked).
3. Re-run export → import for a final delta.
4. Re-check `import-report.json`.
5. Set production [`config.js`](config.js):
   ```js
   const EMPIRE_API_URL = 'https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api';
   ```
6. Push frontend to GitHub `main`; hard-refresh / bump `APP_VERSION`.
7. Smoke-test login + one write per department.
8. Keep the Sheet **read-only ~1–2 weeks**. Rollback = clear `EMPIRE_API_URL` and unfreeze Apps Script.

---

## Safety rules

- No cutover until counts match and staging checklist passes.
- No dual-write in production.
- Service role key **never** in frontend or git.
- Do not delete `empire-all-in-one.gs` until the rollback window ends.

---

## Rollback

1. `EMPIRE_API_URL = ''` in `config.js` → redeploy Pages.
2. Set `FREEZE_WRITES = false` and redeploy Apps Script.
3. Sheet data is only as fresh as the freeze moment — if users wrote to Supabase after cutover, re-exporting from Postgres is a separate recovery step.
