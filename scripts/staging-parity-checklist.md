# Staging parity checklist (before production cutover)

Point a **local** `config.js` at the Edge Function (`EMPIRE_API_URL`) — do not push to GitHub Pages yet.

Function URL shape:
`https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api`

## Auth
- [ ] Login with existing username/password (hashed import)
- [ ] Wrong password rejected
- [ ] `getPerms` returns role / hide / projects / trade
- [ ] Department-restricted user cannot open other sections
- [ ] After password change in DB, old sessions expire on TTL (re-login works)

## Hub
- [ ] `getSummary` shows open counts for allowed departments

## Cleaning
- [ ] Save / list / delete report (delete → Trash)
- [ ] Task checklist set/get/reset
- [ ] Add task photos (≤3), GPS + camera/gallery source
- [ ] Week coverage + range coverage
- [ ] Task log
- [ ] Offline photo queue still syncs to Storage then API

## Civil / Electric issues
- [ ] Add / update / list / delete
- [ ] Assign workers + voice note
- [ ] Worker partial then full mark-fixed
- [ ] Route not-dept / restore / fix delay
- [ ] Recycle bin restore

## Fire / HSE
- [ ] Add / list / mark fixed / delete

## Civil / Electrical jobs
- [ ] Add / update / delete / monthly summary
- [ ] Electric field report → transfer to job
- [ ] Fixed electric issue → transfer to job

## ASAAS / Application
- [ ] Add warehouse item, guard sticker, mark returned
- [ ] Application check list / update / history

## Workers
- [ ] Report location / get locations (live map)

## Destructive (admin only, staging data)
- [ ] Clear actions require reset password
- [ ] Trash purge

## Sign-off
- [ ] Row counts in `migration-data/import-report.json` match expectations
- [ ] No dual-write (Sheet frozen or unused)
- [ ] Ready for Phase 5 cutover
