# Apartment invite bot

WhatsApp (unknown numbers) → SAP Business One unit phone → Empire portal invitation.
Runs on the office PC that has SAP Business One and the LAN cable. Has nothing to do with Bobby.

## Set up on the office PC
1. Install Python 3.12+ from python.org (tick "Add python to PATH") and Git.
2. `git clone https://github.com/dizayeswar/Empire-General-Service.git` (or `git pull` if already there).
3. Double-click `invite-bot\setup.bat`.
4. Double-click `invite-bot\start-invite-bot.bat`, scan the WhatsApp QR with the apartments phone.

## Modes
- `python main.py --dry-run` – only prints what it would do
- `python main.py --confirm` – asks y/n before each apartment
- `python main.py --auto` – no questions, problems go to `log.txt`

## SAP Business One
- The bot opens SAP itself when an apartment is waiting, logs in, does all waiting
  apartments, then closes SAP (SAP glitches when left open).
- Save the SAP password once (kept in Windows Credential Manager, not in any file):
  `python sap_session.py save-password`
- Test by hand: `python sap_session.py login`, then `python sap_session.py close`.
- Wrong password: the bot closes SAP and does not try again until it is restarted
  (so the SAP user is not locked). Apartments stay waiting.
- A SAP problem on an apartment (red line, not found, ...): screenshot in `screenshots/`,
  SAP closed without saving, apartment marked failed, next apartment continues.

## Portal invitation
- Uses the bot's own Edge window (`profiles/edge`). Sign in there once by hand and let Edge
  save the password; if the login page shows later, the bot only clicks SIGN IN (once - if it
  fails, the system is being updated and the bot leaves it for 15 minutes).
- Customers -> All -> FILTER -> Phone Number -> FILTER, then by INVITATION STATUS:
  Not Invited = Send Invitation + YES, INVITE; Activated / Invitation Pending = done;
  Blocked, 2+ rows = reported; No results = tried every minute for 5 minutes, then reported.
- Always FILTER -> CLEAR FILTERS at the end.
- Order in the bot: SAP for all waiting apartments, SAP closed, then the portal.

`config.local.json`, `queue.db`, `log.txt`, `screenshots/` and `profiles/` (logins) stay on that PC only.
