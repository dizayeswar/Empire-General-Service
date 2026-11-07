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
- Save the SAP password once (Windows asks for it, it is not written to any file):
  `cmdkey /generic:"EmpireInviteBot SAP" /user:SAP044 /pass`
- Test by hand: `python sap_session.py login`, then `python sap_session.py close`.
- Wrong password: the bot closes SAP and does not try again until it is restarted
  (so the SAP user is not locked). Apartments stay waiting.
- A SAP problem on an apartment (red line, not found, ...): screenshot in `screenshots/`,
  SAP closed without saving, apartment marked failed, next apartment continues.

## Not finished
- `portal.py` – needs the portal search and invite buttons recorded

`config.local.json`, `queue.db`, `log.txt`, `screenshots/` and `profiles/` (logins) stay on that PC only.
