# Empire General Service — Claude Code rules

Website work moved from Cursor to Claude Code. **Bobby and Charging Electricity stay in Cursor.** See `README.md` and `DEPLOY.md` for how the site and `empire-api` work.

## Bobby and Charging Electricity are Cursor-only

Claude never edits, runs, or deploys anything connected to Bobby:

- `charge-robot/` (the whole folder)
- `charging-electricity.html`
- `assets/empire-charging.js`, `assets/empire-charging.css`
- `.cursor/rules/bobby-charging.mdc`
- The charging parts of the backend: the `charging_requests` table, the website Bot On/Off switch, and the charging code in `supabase/` / `empire-api`

Never run Bobby: no `watch_loop.ps1`, `watch_open.py`, ADB, NovaSys, or Overseas. “Start watching Bobby”, “Bobby stop watching” and any charging request belong in Cursor. A second watch fights the first one on the phone — wrong apartment = real money.

Bobby runs from this same folder. Never switch branches, reset, or stash here without asking — it changes the `charge-robot/` files under a running watch.

## Warn in CAPITAL LETTERS

Before any change that could affect Bobby, Charging Electricity, the shared `empire-api`, or the HR-F-06 Leave form: stop, warn the user IN CAPITAL LETTERS, and wait for a yes. Example:

**⚠️ WARNING: THIS CHANGE TOUCHES THE SHARED EMPIRE-API THAT BOBBY USES. DO YOU WANT ME TO CONTINUE?**

Always warn and ask before deploying `empire-api` — Bobby saves its charge rows through it.

## HR-F-06 Leave form is locked

`hr-leave.html`, `assets/empire-hr.css`, `assets/empire-hr-leave.js`: the paper must not change in any way. Any edit to these files needs a CAPITAL-LETTER warning and a yes first.

@.cursor/rules/hr-f06-layout-lock.mdc

## Git

`git pull` before starting work — Cursor pushes to the same repo.

@.cursor/rules/always-push.mdc

## Supabase SQL

@.cursor/rules/named-sql-queries.mdc
