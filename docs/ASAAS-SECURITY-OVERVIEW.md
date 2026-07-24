# A.S.A.A.S — Security & Architecture Overview

**System:** Empire World EGS — West Wing Corridor Storage  
**Prepared for:** Security Team Review  
**Author:** Swar Dizayee / Empire General Service  
**Live URL:** https://dizayeswar.github.io/Empire-General-Service/asaas.html  
**Backend:** Google Apps Script Web App + Google Sheets  
**Version reference:** `empire-all-in-one.gs` (AsaasItems handlers)

---

## 1. Purpose

**A.S.A.A.S** (displayed as “A.S.A.A.S” in the UI) tracks items temporarily stored in **West Wing (WW) building corridors** when residents remove belongings during maintenance or moves.

The system supports two operational modes:

| Mode | User | Device | Primary actions |
|------|------|--------|-----------------|
| **Mobile guard** | `asaas_guard1` | Phone / PWA | Log items into warehouse, attach sticker photo, mark returned |
| **Office portal** | Security coordinators, admins, viewers | Desktop / tablet | View all items, analytics, export reports |

Every logged item receives a permanent reference number (**A#1**, **A#2**, …) and a full photo trail (corridor photo → optional sticker photo → signed return paper).

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     GitHub Pages (static frontend)                       │
│  asaas.html + asaas-app.js + empire-auth.js + empire-storage.js         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS POST JSON
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Google Apps Script Web App (empire-all-in-one.gs)           │
│  doPost → verifyToken(token, dept='asaas') → handle*Asaas*             │
└───────────────┬─────────────────────────────┬───────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌───────────────────────────────────────┐
│ Google Spreadsheet         │   │ Supabase Storage (public bucket)         │
│ Sheet: AsaasItems          │   │ Folder: issues/asaas/{YYYY-MM}/        │
│ Sheet: Users, Tokens       │   │ Photos uploaded with anon key (client) │
└───────────────────────────┘   └───────────────────────────────────────┘
```

### External services

| Service | Role | Config location |
|---------|------|-----------------|
| **GitHub Pages** | Hosts HTML/JS/CSS | Repository `main` branch |
| **Google Apps Script** | REST API, auth, business logic | `config.js` → `GOOGLE_SCRIPT_URL` |
| **Google Sheets** | Primary database | `SHEET_ID` in `empire-all-in-one.gs` |
| **Supabase Storage** | Photo hosting | `config.js` → `SUPABASE_CONFIG` |
| **Firebase SW** | PWA shell cache only (no ASaaS push) | `firebase-messaging-sw.js` |

---

## 3. User Accounts & Access Model

### 3.1 Department gate

All ASaaS API calls require a session token whose department includes **`asaas`** (or **`all`** for global admins).

- Login sends `{ action: 'verifyLogin', dept: 'asaas', username, password }`
- Server checks `Users` sheet column C (department) via `deptListAllows_()`
- Hub tile on `index.html` is hidden unless `empireCanAccessDept('asaas')` is true

### 3.2 UI routing (username-based)

After login, the client chooses the interface by **username**, not by role:

| Username | Function | UI container |
|----------|----------|--------------|
| **`asaas_guard1`** | `isAsaasMobile_()` | `#asaasMobileApp` — compact mobile layout |
| **Any other `asaas` user** | Office path | `#asaasOfficeApp` — sidebar + analytics |

Code: `asaasRouteView_()` in `assets/asaas-app.js`.

### 3.3 Roles (Users sheet column D)

| Role | Platform permissions | ASaaS UI behavior |
|------|---------------------|-------------------|
| **admin** | Full system access | Office portal + export |
| **editor** | Add/edit/delete (platform) | Office portal + export |
| **viewer** | Read-only (platform) | Office portal (same read UI; export still runs client-side) |
| **worker** | Limited (platform) | Guard account uses `worker` role but **trade column G is waived** when dept is exactly `asaas` |

**Important:** ASaaS backend enforcement for sensitive actions uses **username `asaas_guard1`**, not role checks.

---

## 4. Mobile Guard Journey (`asaas_guard1`)

### 4.1 Login

1. Open `asaas.html` (or hub → A.S.A.A.S tile).
2. Enter username / password → `asaasHandleLogin_()` → `empireAuthLogin(e, 'asaas')`.
3. Server validates credentials, issues UUID token (30-day TTL), stores in `Tokens` sheet + browser `localStorage`.
4. Client routes to `#asaasMobileApp` (`asaasEnterMobile_()`).

### 4.2 Log item (warehouse intake)

**Tab:** Log item (`#asaasLogPanel`)

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | Select building (WW1–WW15), floor, corridor spot, optional apartment (A–H) | Dropdowns from `ASAAS_WW_FLOORS`, `ASAAS_SPOTS`, `ASAAS_APARTMENTS` |
| 2 | Enter item description | Free text |
| 3 | Take corridor photo (camera or gallery) | `empireWorkerPickPhoto()` → compress → upload |
| 4 | Tap Save | `asaasSubmitItem_()` → `addAsaasItem` API |

**Photo upload path (before API call):**

```
File → empireCompressImage(max 1400px, quality 0.7)
     → empireUploadPhoto(folder: issues/asaas)
     → Supabase POST → public URL returned
     → URL sent in addAsaasItem body as photo
```

**Server (`handleAddAsaasItem`):**

- Requires: building, floor, corridor **photo** URL
- Assigns sequential **A#** via `nextAsaasNum_()` (Script Properties + sheet)
- Sets `status = in_warehouse`
- Records `removedBy` (username), `removedByName`, `createdAt`
- Appends row to `AsaasItems` sheet

### 4.3 Sticker photo (physical label on item)

**Tab:** In warehouse → tap item card → detail modal

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | Open item (status `in_warehouse`) | `asaasOpenViewModal_()` |
| 2 | Take sticker photo | Upload to Supabase |
| 3 | Save sticker | `asaasSaveStickerPhoto_()` → `updateAsaasItem` |

**Server (`handleUpdateAsaasItem`):**

- **Only `asaas_guard1`** may call this successfully
- Guard may **only** set `photo2` (sticker URL)
- Rejects if item already `returned`

### 4.4 Return to resident

**Same modal — Return section**

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | Enter collector name (`returnedTo`) | Required text |
| 2 | Optional apartment / note | Stored in sheet |
| 3 | Photo of signed paper | Required; uploaded to Supabase |
| 4 | Confirm return | `asaasMarkReturned_()` → `markAsaasReturned` |

**Server (`handleMarkAsaasReturned`):**

- **Only `asaas_guard1`**
- Requires collector name + return photo URL
- Sets `status = returned`, timestamps, locks further edits

### 4.5 Mobile logout (security control)

- Logout requires **password re-entry** (`empireAuthWorkerLogout({ requirePassword: true })`)
- Calls `verifyPassword` API before clearing `localStorage` session
- Prevents casual logout/session abuse on shared guard phones

### 4.6 Language

- Toggle EN ↔ Sorani (Central Kurdish) via `asaas-i18n.js`
- Affects all mobile labels and logout modal

---

## 5. Office Portal Journey (non-guard users)

### 5.1 Login & entry

Same login flow with `dept: 'asaas'`. Any user **except** `asaas_guard1` enters `#asaasOfficeApp` (`asaasEnterOffice_()`).

### 5.2 All items tab

| Feature | Behavior |
|---------|----------|
| List | Card grid of all warehouse + returned items |
| Filter | By status (`in_warehouse` / `returned`) |
| Search | Reference number, location, description |
| Item detail | Click card → `asaasOpenReturnModal_()` — **view only** |
| Return actions | **Disabled** — office cannot mark returns |

### 5.3 Analytics tab

| Feature | Behavior |
|---------|----------|
| Summary stats | Count in warehouse, returned, days in storage |
| Sortable table | Full item list with metadata |
| Excel export | `asaasDownloadExcel()` — `asaas-excel.js` |
| HTML report | `asaasDownloadReport()` — printable summary |

### 5.4 Office logout

- **No password required** — immediate session clear + redirect to hub
- Rationale: desktop session in controlled office environment

---

## 6. Item Lifecycle (State Machine)

```
                    addAsaasItem
                         │
                         ▼
              ┌─────────────────────┐
              │   IN WAREHOUSE      │
              │   status:           │
              │   in_warehouse      │
              │   photo: corridor   │
              └─────────┬───────────┘
                        │
            updateAsaasItem (guard only)
            sets photo2 = sticker
                        │
                        ▼
              ┌─────────────────────┐
              │   IN WAREHOUSE      │
              │   + sticker photo   │
              └─────────┬───────────┘
                        │
           markAsaasReturned (guard only)
           + collector name + signed paper photo
                        │
                        ▼
              ┌─────────────────────┐
              │   RETURNED          │
              │   status: returned  │
              │   IMMUTABLE         │
              └─────────────────────┘
```

Returned items **cannot** be edited or re-opened (server-enforced).

---

## 7. Data Model — `AsaasItems` Sheet

| Col | Field | Description |
|-----|-------|-------------|
| A | `id` | Unique key, e.g. `asaas-1720000000000` |
| B | `num` | Sequential reference → displayed as **A#N** |
| C | `date` | Log date (yyyy-MM-dd) |
| D | `building` | WW1 … WW15 |
| E | `floor` | B1, Ground, F1 … |
| F | `spot` | Corridor, Parking, Elevator lobby, etc. |
| G | `itemDescription` | Free text |
| H | `photo` | Corridor photo URL (Supabase) |
| I | `apartment` | Optional A–H |
| J | `status` | `in_warehouse` or `returned` |
| K | `warehouseNote` | Reserved (not used in UI) |
| L | `removedBy` | Username who logged item |
| M | `removedByName` | Display name |
| N | `createdAt` | ISO timestamp |
| O | `returnedAt` | Set on return |
| P | `returnedTo` | Collector / resident name |
| Q | `returnApartment` | Apartment on return |
| R | `returnPhoto` | Signed paper photo URL |
| S | `returnNote` | Optional note |
| T | `updatedAt` | Last mutation time |
| U | `photo2` | Sticker photo URL |

**Location display format:** `WW-3-5-A` (building-floor-apartment) via `asaasLocStr_()`.

---

## 8. API Reference (Security-Relevant)

All actions: `POST` JSON to `GOOGLE_SCRIPT_URL` with `token` field.  
Auth: `verifyToken(token, 'asaas')` unless noted.

| Action | Who can use (server) | What it does |
|--------|----------------------|--------------|
| `verifyLogin` | Anyone with valid Users row + `asaas` dept | Creates session token |
| `verifyPassword` | Username/password match | Mobile logout confirmation |
| `getAsaasItems` | Any valid `asaas` token | Read all items |
| `addAsaasItem` | Any valid `asaas` token | Create warehouse item (**not restricted to guard**) |
| `updateAsaasItem` | **`asaas_guard1` only** | Sticker photo only |
| `markAsaasReturned` | **`asaas_guard1` only** | Close item as returned |
| `deleteAsaasItem` | Any valid `asaas` token | Delete row (**no admin check; not in UI**) |
| `clearAsaasItems` | Any valid `asaas` token | Wipe all rows (**no admin check; not in UI**) |
| `getSummary` | Hub session with `asaas` access | Count items in warehouse |

---

## 9. Authentication & Session Details

### 9.1 Session storage (browser)

| Key | Content |
|-----|---------|
| `empire_token` | UUID session token |
| `empire_user` | Username |
| `empire_role` | admin / editor / viewer / worker |
| `empire_token_dept` | e.g. `asaas` or `all` |
| `empire_perms` | JSON permission object |

Stored in **`localStorage`** (not HttpOnly cookies).

### 9.2 Token lifecycle

- Created on login → appended to **`Tokens`** sheet
- TTL: **30 days** (`TOKEN_TTL`)
- Invalidated when: token expires, password changed (digest mismatch), manual revoke
- Each API call re-validates token + department

### 9.3 Credential storage

- User passwords stored as **plaintext** in `Users` sheet column B
- Login compares plaintext match server-side
- Security team should treat spreadsheet access as **full credential compromise**

---

## 10. Photo & Media Security

| Topic | Detail |
|-------|--------|
| **Upload** | Client-side direct to Supabase using **anon public key** in `config.js` |
| **Folder** | `empire-photos` bucket → `issues/asaas/{YYYY-MM}/{uuid}.jpg` |
| **Access** | Public URLs — anyone with link can view photo |
| **Content** | Corridor photos, item stickers, signed return documents (PII-adjacent) |
| **RLS** | Depends on Supabase bucket policies (review separately) |

---

## 11. Security Strengths

1. **Department isolation** — ASaaS data/API separated from other EGS modules (`cleaning`, `civil issue`, etc.).
2. **Guard-only return path** — `markAsaasReturned` hard-coded to username `asaas_guard1` on server.
3. **Guard-only sticker updates** — `updateAsaasItem` restricted to guard; only `photo2` field writable.
4. **Returned items immutable** — no further edits after return.
5. **Mandatory evidence photos** — corridor photo on log; signed paper on return.
6. **Mobile logout password gate** — reduces session hijack on shared devices.
7. **Audit fields** — `removedBy`, `removedByName`, timestamps on every record.
8. **Sequential reference numbers** — tamper-evident A# sequence via Script Properties lock.

---

## 12. Security Gaps & Recommendations (for review)

| # | Finding | Risk | Recommendation |
|---|---------|------|----------------|
| 1 | Plaintext passwords in Google Sheet | High | Hash passwords; migrate to secure auth |
| 2 | Session token in `localStorage` | Medium | XSS or physical device access → session theft |
| 3 | `addAsaasItem` open to any `asaas` token | Medium | Restrict to `asaas_guard1` on server |
| 4 | `deleteAsaasItem` / `clearAsaasItems` no role check | High | Admin-only + remove from public API or add UI audit |
| 5 | Supabase anon key in public `config.js` | Medium | Tight bucket RLS; signed upload URLs |
| 6 | Public photo URLs | Medium | Signed URLs with expiry for sensitive docs |
| 7 | Office UI ignores role for export | Low | Gate export by role if viewers should not export |
| 8 | UI split by username not role | Low | Use role/dept flag instead of hard-coded username |
| 9 | No dedicated audit log sheet | Low | Append-only mutation log for compliance |
| 10 | No rate limiting on API | Medium | Apps Script quotas + WAF if exposed further |
| 11 | No ASaaS push notifications | Info | Operational only — not a security issue |
| 12 | No offline queue for ASaaS | Info | Failed saves lost without network (operational) |

---

## 13. PWA / Offline Behavior

| Feature | ASaaS support |
|---------|---------------|
| Install to home screen | Yes (`manifest.webmanifest`) |
| Service worker cache | Shell assets via `firebase-messaging-sw.js` |
| Offline CRUD | **No** — all saves require live API |
| Push notifications | **No ASaaS-specific alerts** |

---

## 14. Key Source Files (for auditors)

| File | Purpose |
|------|---------|
| `asaas.html` | Page shell, mobile + office containers, login |
| `assets/asaas-app.js` | All UI logic, API calls, routing |
| `assets/asaas-i18n.js` | EN / Sorani translations |
| `assets/asaas-excel.js` | Office export |
| `assets/asaas.css` | Styling |
| `assets/empire-auth.js` | Login, session, logout, dept routing |
| `assets/empire-storage.js` | Photo compress + Supabase upload |
| `assets/empire-api.js` | `fetchJSONRetry`, `empireLogin` |
| `config.js` | API URL, Supabase keys, Firebase config |
| `empire-all-in-one.gs` | All backend handlers (~lines 4136–4395) |

---

## 15. Companion Diagram

Open **`docs/ASAAS-Security-Architecture.excalidraw`** in [Excalidraw](https://excalidraw.com) (File → Open) for visual architecture, user flows, auth model, and data lifecycle diagrams.

---

*Document generated from Empire General Service codebase. For questions contact the system administrator.*
