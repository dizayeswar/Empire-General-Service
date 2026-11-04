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

## Not finished
- `sap_b1.py` – needs the SAP screen/fields recorded on the office PC
- `portal.py` – needs the portal search and invite buttons recorded

`config.local.json`, `queue.db`, `log.txt` and `profiles/` (logins) stay on that PC only.
