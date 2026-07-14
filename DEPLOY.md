# Empire General Service — Deployment Guide

Use this guide when you update the frontend (GitHub Pages) or backend (Google Apps Script).

**Live site:** https://dizayeswar.github.io/Empire-General-Service/

---

## Architecture

| Layer | What it does | Where it lives |
|-------|----------------|----------------|
| **Frontend** | HTML, CSS, JS dashboards | GitHub → GitHub Pages |
| **Backend API** | Login, save reports, issues, task photos | Google Apps Script (`empire-all-in-one.gs`) |
| **Database** | All operational data | Google Sheet (linked in the script) |
| **Photos** | Image hosting | ImgBB (uploaded from the browser) |

The frontend calls the Apps Script URL in `config.js`. Data is **not** stored only in the browser — it is saved to Google Sheets via the API.

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

## 2. Deploy backend (Google Apps Script)

**Required** after any change to `empire-all-in-one.gs`.

### Steps

1. Open [Google Apps Script](https://script.google.com) for the Empire project.
2. Replace the editor contents with the latest `empire-all-in-one.gs` from this repo.
3. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**  
   (Or **Deploy → New deployment** if this is the first time.)
4. Deployment type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL if it changed, and update `GOOGLE_SCRIPT_URL` in `config.js` if needed.

### Verify backend

Open in a browser (GET request):

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Expected response:

```json
{"ok":true,"msg":"Empire API running","version":"2026-07-12-password-change-logout"}
```

The `version` string must match `SCRIPT_VERSION` at the top of `empire-all-in-one.gs`.

### Common backend issues

| Symptom | Fix |
|---------|-----|
| “Invalid server response” / HTML instead of JSON | Redeploy Apps Script; wait 1–2 minutes |
| “Unknown action” on recycle bin or batch photos | Backend not updated — redeploy |
| Login very slow (20–60 s) | Normal for cold Google Apps Script; retry |
| User logged out after password change | Expected — password digest changed in Users sheet |

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
| G | Trade (civil workers only) | `pipes`, `painting`, `tiles`, or `wood` (Carpentry) |

### Civil issue teams (assignment)

Engineer assigns open issues to one of four teams. All workers with that trade see the job; whoever completes it is recorded as **Fixed by**.

| Trade ID | Display name | Typical work |
|----------|--------------|--------------|
| `pipes` | Pipes | Leakage, plumbing |
| `painting` | Painting | Repainting, mold |
| `tiles` | Tiles | Broken tiles, cracked walls |
| `wood` | Carpentry | Doors, locks, curtains, handles |

### Example civil accounts

| Username | Dept | Role | Trade |
|----------|------|------|-------|
| `civil_eng` | civil issue | editor | *(blank — engineer)* |
| `pipes_1` | civil issue | worker | pipes |
| `tiles_1` | civil issue | worker | tiles |
| `paint_1` | civil issue | worker | painting |
| `wood_1` | civil issue | worker | wood |

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

---

## 5. Offline photo queue (cleaning)

Cleaning supervisors can save task photos without signal. Photos queue in the browser (IndexedDB) and sync when online.

- Pending uploads show a yellow banner with **Sync now**.
- Task photos show **⏳ pending sync** until uploaded.
- Requires PWA or normal browser with IndexedDB (all modern phones).

---

## 6. Release checklist

Use this after each release:

- [ ] `empire-all-in-one.gs` copied to Apps Script and redeployed
- [ ] GET `/exec` returns expected `SCRIPT_VERSION`
- [ ] `config.js` `GOOGLE_SCRIPT_URL` matches deployment URL
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
empire-all-in-one.gs    Backend (Apps Script — not served by GitHub)
assets/empire-auth.js   Login, session, logout
assets/empire-api.js    fetchJSONRetry, login helper
assets/empire-core.js   Theme, filters, PWA loader
assets/empire-offline-queue.js  Offline photo queue
assets/issue-tracker.js Shared issue page logic
manifest.webmanifest    PWA manifest
service-worker.js       Offline shell cache
```

---

Prepared by **Swar Dizayee** — Empire World General Service
