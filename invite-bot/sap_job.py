"""The SAP part of the website bot, run as its own short program with no window.

website_bot.py starts it for a batch of apartments; it opens SAP, does them one by one, closes
SAP and exits - exactly like `python sap_session.py full`, which worked (2026-11-08). SAP hung on
Update when the bot's console window, Edge and the "Bot online" ping were running in the same
program, so nothing else runs in here.

Input (stdin):  JSON list of {"id", "unitCode", "phone"}
Output (stdout): one JSON line per event:
  {"id": .., "event": "start"}
  {"id": .., "event": "ok", "old": ".."}
  {"id": .., "event": "portal_sync", "error": ".."}   SAP saved, portal sync said no
  {"id": .., "event": "sap_error", "error": "..", "shot": ".."}
  {"id": .., "event": "login", "error": ".."}         login refused / not possible
  {"event": "closed"}
"""
import json
import os
import sys

import sap_b1
import sap_session

HERE = os.path.dirname(os.path.abspath(__file__))


def load_config():
    path = os.path.join(HERE, "config.local.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def run_jobs(jobs, config, sap, emit):
    try:
        for i, job in enumerate(jobs):
            rid, code, phone = job["id"], job["unitCode"], job["phone"]
            emit({"id": rid, "event": "start"})
            try:
                sap.ensure()
            except sap_session.SapLoginError as e:
                for rest in jobs[i:]:
                    emit({"id": rest["id"], "event": "login", "error": str(e)})
                return
            try:
                old = sap_b1.update_unit_phone(config, code, phone)
                emit({"id": rid, "event": "ok", "old": old})
            except sap_b1.PortalSyncError as e:
                emit({"id": rid, "event": "portal_sync", "error": str(e)})  # SAP itself is clean
            except Exception as e:
                shot = sap.after_error(code)
                emit({"id": rid, "event": "sap_error", "error": str(e),
                      "shot": os.path.basename(shot) if shot else ""})
    finally:
        sap.close()
        emit({"event": "closed"})


def main():
    jobs = json.loads(sys.stdin.read() or "[]")

    def emit(obj):
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

    run_jobs(jobs, load_config(), sap_session.SapSession(lambda m: emit({"log": m})), emit)


if __name__ == "__main__":
    main()
