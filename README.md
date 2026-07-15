# Empire General Service (EGS)

Web dashboards for Empire World departments: cleaning, civil, electrical, HSE, and on-site issue tracking.

**Live site:** https://dizayeswar.github.io/Empire-General-Service/

---

## Departments

| Section | Pages |
|---------|--------|
| **Hub** | `index.html` — login, live stats, department tiles |
| **Cleaning** | `cleaning-dashboard.html` — daily reports, task checklists, monthly report |
| **Cleaning issues** | `civil-issue.html`, `fire-issue.html`, `electric-issue.html` |
| **Civil** | `civil-department.html` — maintenance jobs |
| **Electrical** | `electrical.html` — electrical jobs |
| **HSE** | `hse-inspection.html` — fire safety equipment inspections |

---

## Features

- Single login with session across dashboards
- Role-based access (admin / editor / viewer) via Google Sheet **Users** tab
- Per-user project scope for cleaning supervisors
- Per-user section hiding (e.g. hide Analytics)
- Live open-issue counts on the hub
- PWA — install on phone for full-screen use on site
- Offline photo queue — cleaning task photos save without signal, sync later
- Filter memory — search/filters restored when returning to a page (same tab)
- Recycle bin — restore deleted reports and photos
- Dark / light theme

---

## Data storage

All reports, issues, task photos, and checklists are saved to a **Google Sheet** through Google Apps Script. The browser keeps short-term caches for speed; the sheet is the source of truth.

Photos are uploaded to **Supabase Storage** from the browser, then the image URL is stored in the sheet. See **[SUPABASE-MIGRATION.md](SUPABASE-MIGRATION.md)** to migrate existing ImgBB photos.

---

## For administrators

See **[DEPLOY.md](DEPLOY.md)** for:

- Redeploying Google Apps Script after backend changes
- GitHub Pages frontend updates
- Users sheet column reference
- PWA and offline queue notes
- Release checklist

### Quick redeploy reminder

1. Copy `empire-all-in-one.gs` → Apps Script → **Deploy new version**
2. Push frontend changes to GitHub `main`
3. Hard refresh the live site

---

## For supervisors

1. Open the live link (or your installed home-screen app).
2. Log in with your username and password.
3. Cleaning-only users go straight to the cleaning dashboard.
4. Multi-department users see the hub and pick a section.
5. On poor signal: confirm task photos anyway — they queue and sync when online.

---

## Project structure

```
assets/           Shared CSS, JS (auth, API, core, issue tracker, PWA, offline queue)
icons/            PWA home-screen icons
config.js         Backend URL and app version
empire-all-in-one.gs   Backend API (deploy to Google Apps Script, not GitHub Pages)
*.html            Department dashboards
DEPLOY.md         Full deployment guide
```

---

## Support

Prepared by **Swar Dizayee**.

For deployment or access changes, update the **Users** sheet and redeploy Apps Script as described in [DEPLOY.md](DEPLOY.md).
