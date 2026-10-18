# Empire General Service — Deployment Guide

Use this guide when you update the frontend (GitHub Pages) or backend (Supabase Edge Function `empire-api`).

**Live site:** https://dizayeswar.github.io/Empire-General-Service/

---

## Architecture

| Layer | What it does | Where it lives |
|-------|----------------|----------------|
| **Frontend** | HTML, CSS, JS dashboards | GitHub → GitHub Pages |
| **Backend API** | Login, save reports, issues, task photos | Supabase Edge Function `supabase/functions/empire-api` |
| **Database** | All operational data | Supabase Postgres (`supabase/migrations`) |
| **Photos** | Image hosting | Supabase Storage (see [SUPABASE-MIGRATION.md](SUPABASE-MIGRATION.md)) |

The frontend calls `EMPIRE_API_URL` in `config.js`. Data is **not** stored only in the browser — it is saved to Supabase via the API. The old Google Apps Script backend was retired after the 2026-08-10 cutover.

---

## 1. Deploy frontend (GitHub Pages)

After code changes are pushed to `main`:

1. GitHub Pages rebuilds automatically (usually 1–3 minutes).
2. Tell supervisors to **hard refresh** (Ctrl+F5) or reinstall the PWA shortcut if they use “Add to Home Screen”.
3. A new service worker version forces cache refresh — check `CACHE_VERSION` in `service-worker.js`.

### Verify frontend

Open: https://dizayeswar.github.io/Empire-General-Service/

- Login page loads
- Theme toggle works
- After login, department tiles appear

---

## 2. Deploy backend (Supabase Edge Function)

**Required** after any change under `supabase/functions/empire-api/`.

### Steps

```
npx supabase functions deploy empire-api --no-verify-jwt --project-ref nobcitpaudeopzfymgzi
```

Database changes go in a new file under `supabase/migrations/` and are run in Supabase **SQL Editor**.

### Verify backend

Open in a browser (GET request):

```
https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api
```

Expected response:

```json
{"ok":true,"msg":"Empire API running (Supabase)","version":"..."}
```

The `version` string must match the one returned in `supabase/functions/empire-api/index.ts`.

### Common backend issues

| Symptom | Fix |
|---------|-----|
| “Invalid server response” / HTML instead of JSON | Redeploy `empire-api`; check Edge Function logs |
| “Unknown action” | Backend not updated — redeploy `empire-api` |
| User logged out after password change | Expected — password digest changed |

---

## 3. Users sheet setup

Sheet tab: **Users**

| Column | Field | Example |
|--------|-------|---------|
| A | Username | `ibrahim` |
| B | Password | `****` |
| C | Department | `cleaning` or `civil department,hse` or `all` |
| D | Role | `admin`, `editor`, or `viewer` |
| E | Hide (optional) | `Analytics` or `Dashboard,Monthly` or `live location` |
| F | Projects (cleaning only) | `ec,es` — blank = all projects |
| G | Trade (civil workers only) | `plumber`, `painting`, `tiles`, or `wood` (Carpentry). Legacy `pipes` still works. |

### Civil issue assignment (individual workers)

Engineers assign each open issue to **one or more named workers** (up to 4). Only those workers see the job in their mobile app. If **more than one** worker is assigned, **each** must submit completion photos — the job stays open until all assigned workers have uploaded.

| Trade ID | Display name | Workers (Users sheet username = id slug) |
|----------|--------------|------------------------------------------|
| `wood` | Carpentry | `mohammed_luqman`, `saeed_shahuth`, `shakhwan_dilshad`, `abdulsamad_sulaiaman` |
| `tiles` | Tiles | `mohammed_qasim`, `rayan_hazhar`, `farman_ahmed` |
| `plumber` | Plumber | `sear_samad`, `aram_majid`, `dlawar_kamal`, `shwan_ali`, `abdulsamad_sulaiaman` |
| `painting` | Painting | `halmat_abozaid`, `sardam_sardar`, `farman_ahmed`, `rayan_hazhar` |

Some people work in more than one team — give them **one account** (one username). Assign them from any team picker; they only see jobs where their username is selected.

### Example civil accounts

| Username | Dept | Role | Trade |
|----------|------|------|-------|
| `civil_eng` | civil issue | editor | *(blank — engineer)* |
| `mohammed_luqman` | civil issue | worker | wood |
| `farman_ahmed` | civil issue | worker | tiles *(or painting — pick primary trade)* |
| `sear_samad` | civil issue | worker | plumber |
| `halmat_abozaid` | civil issue | worker | painting |

### Cleaning project codes

| Code | Project |
|------|---------|
| `ec` | Empire Complex |
| `es` | Empire Square |
| `wd` | West Diamond |
| `ww` | West Wing |
| `ww2` | West Wing 2 |
| `ra` | Royal Apartment |

### Hide column keywords

Comma-separated, case-insensitive: `add`, `edit`, `delete`, `analytics`, `report` / `monthly`, `dashboard` / `dash`, `categories`, `live location`.

---

## 4. PWA (install on phone)

Supervisors can install the app from Chrome (Android) or Safari (iPhone):

1. Open the live site.
2. **Android:** tap **Install** on the banner, or menu → Add to Home screen.
3. **iPhone:** Share → Add to Home Screen.

Icons are in `icons/` (192, 512, maskable). After icon changes, bump `CACHE_VERSION` in `service-worker.js` and redeploy frontend.

### Worker job alerts (lock-screen notifications)

When an engineer assigns a job, assigned workers get a **popup notification** — including when the phone is locked.

**One-time setup (Firebase Cloud Messaging):**

1. Create a [Firebase project](https://console.firebase.google.com/) (free).
2. Add a **Web app** with your live URL host: `dizayeswar.github.io`.
3. In Firebase → **Project settings → Cloud Messaging → Web configuration**, generate a **Web Push certificate** (VAPID key pair). Copy the **public key** (Key pair).
4. In Firebase → **Project settings → Service accounts**, click **Generate new private key**. Save the JSON file — `empire-api` uses this to send notifications (FCM HTTP v1 API).
5. Fill in `config.js`:
   - `FIREBASE_CONFIG` — apiKey, authDomain, projectId, messagingSenderId, appId from Firebase web app settings
   - `FIREBASE_VAPID_KEY` — the Web Push public key from step 3
6. In Supabase → **Edge Functions → Secrets**, add:
   - `FCM_SERVICE_ACCOUNT_JSON` — entire contents of the service account JSON file (one line is fine)
   - Optional: `FCM_PROJECT_ID` — only if not already inside the JSON (`project_id` field)
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — for leave-assignment alerts (`HR_PUSH_VAPID_KEY` in `config.js` is the public half)
7. Redeploy **frontend** (GitHub) and **backend** (`empire-api`).

If Diagnose on the worker phone shows `FCM:FAIL`, check the secrets above and the Edge Function logs.

**On each worker phone:**

1. Install the PWA (**Add to Home screen** / **Install app**).
2. Log in as the worker account on **Civil Issues**.
3. Tap **Enable alerts** on the banner and allow notifications when prompted.
4. Keep notifications allowed in phone settings for Chrome / the installed app.

| Platform | Lock-screen alerts |
|----------|-------------------|
| Android Chrome (installed PWA) | Yes, after Firebase setup |
| iPhone (iOS 16.4+, installed to Home Screen) | Yes, after Firebase setup |
| Browser tab only (not installed) | Alerts when app is open; limited when backgrounded |

If Firebase is not configured yet, workers still see an **Enable alerts** banner and get in-app popups when the app is open (polls every ~90 seconds).

Backend stores device tokens in Supabase (created automatically when a phone enables alerts).

---

## 5. Offline photo queue (cleaning)

Cleaning supervisors can save task photos without signal. Photos queue in the browser (IndexedDB) and sync when online.

- Pending uploads show a yellow banner with **Sync now**.
- Task photos show **⏳ pending sync** until uploaded.
- Requires PWA or normal browser with IndexedDB (all modern phones).

---

## 6. Release checklist

Use this after each release:

- [ ] `empire-api` redeployed if `supabase/functions/empire-api/` changed
- [ ] GET `empire-api` returns the expected `version`
- [ ] `config.js` `APP_VERSION` bumped if needed
- [ ] `service-worker.js` `CACHE_VERSION` bumped for frontend changes
- [ ] Changes pushed to `main` on GitHub
- [ ] Hard refresh tested on cleaning dashboard + hub login
- [ ] Test login for one cleaning user with project scope

---

## 7. File map (quick reference)

```
index.html              Hub login + department tiles
cleaning.html           Cleaning sub-menu
cleaning-dashboard.html Cleaning daily reports + task photos
civil-department.html   Civil jobs
electrical.html         Electrical jobs
hse-inspection.html     HSE fire equipment checks
*-issue.html            Issue trackers (civil / fire / electric)
config.js               API URL + app version
supabase/               Backend: Edge Function empire-api + Postgres migrations
assets/empire-auth.js   Login, session, logout
assets/empire-api.js    fetchJSONRetry, login helper
assets/empire-core.js   Theme, filters, PWA loader
assets/empire-offline-queue.js  Offline photo queue
assets/empire-push.js     Worker push notification registration
assets/issue-tracker.js Shared issue page logic
manifest.webmanifest    PWA manifest
service-worker.js       Offline shell cache
```

---

Prepared by **Swar Dizayee** — Empire World General Service
