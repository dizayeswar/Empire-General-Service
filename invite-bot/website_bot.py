"""Invite bot driven by the website: Application → Sync to portal.

A person types Unit Code + phone on the website and presses Send. This bot (always running on
the office PC) asks the website for work every few seconds and, with no questions:

  1. SAP for every waiting request (sap_b1.update_unit_phone), then closes SAP
  2. Portal invitation for every request whose SAP part is done (portal.send_invitation)

and writes each step back, so the page shows: Waiting → SAP updating → SAP done → Portal → Done
(Invited / Already activated / Already invited) or Failed with the reason.

  python website_bot.py save-login   once: the website account the bot uses (kept in Windows
                                     Credential Manager, not in any file)
  python website_bot.py              run (start-website-bot.bat)

The website account needs only Application → Sync to portal = Read/Write (Admin → Users).
"""
import datetime
import json
import os
import sys
import threading
import time
import urllib.request

import portal
import sap_b1
import sap_session

HERE = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(HERE, "profiles", "edge")
LOG_PATH = os.path.join(HERE, "log.txt")
API = "https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api"
CRED_TARGET = "EmpireInviteBot Website"
EVERY = 10             # seconds between "any work?" checks
HEARTBEAT = 20         # "bot online" ping while a long step runs (portal can take 5 minutes)
TOKEN_ERRORS = ("No token", "Invalid token", "Token expired")


def log(msg):
    line = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_config():
    path = os.path.join(HERE, "config.local.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class WebsiteError(Exception):
    pass


# ---------------------------------------------------------------- website login

def get_login():
    import win32cred
    try:
        cred = win32cred.CredRead(CRED_TARGET, win32cred.CRED_TYPE_GENERIC)
    except Exception:
        raise WebsiteError("The website login is not saved on this PC. Run once in the invite-bot "
                           "folder:  python website_bot.py save-login")
    return cred["UserName"], cred["CredentialBlob"].decode("utf-16-le")


def save_login():
    import getpass
    import win32cred
    user = input("Website username for the bot: ").strip()
    password = getpass.getpass("Website password (not shown while typing): ")
    if not user or not password:
        sys.exit("Nothing saved.")
    win32cred.CredWrite({
        "Type": win32cred.CRED_TYPE_GENERIC,
        "TargetName": CRED_TARGET,
        "UserName": user,
        "CredentialBlob": password,
        "Persist": win32cred.CRED_PERSIST_LOCAL_MACHINE,
    }, 0)
    api = Website()
    api.login()
    print(f'Saved in Windows Credential Manager as "{CRED_TARGET}" and the login works.')


# ---------------------------------------------------------------- website API

class Website:
    def __init__(self):
        self.token = ""
        self.lock = threading.Lock()

    def _post(self, payload):
        req = urllib.request.Request(API, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def login(self):
        user, password = get_login()
        d = self._post({"action": "login", "username": user, "password": password, "dept": "application"})
        if not d.get("ok"):
            raise WebsiteError(f"Website login refused for {user}: {d.get('message') or d.get('error')}")
        self.token = d["token"]

    def call(self, action, **kw):
        with self.lock:
            if not self.token:
                self.login()
            d = self._post({"action": action, "token": self.token, **kw})
            if not d.get("ok") and str(d.get("error", "")) in TOKEN_ERRORS:
                self.login()
                d = self._post({"action": action, "token": self.token, **kw})
        if not d.get("ok"):
            raise WebsiteError(f"{action}: {d.get('message') or d.get('error')}")
        return d

    def work(self):
        return self.call("getPortalSyncWork")["requests"]

    def update(self, row, status, message, frm=None, result=None):
        """Move the request on; False if it is no longer in `frm` (e.g. cancelled a moment ago)."""
        kw = {"id": row["id"], "status": status, "message": message}
        if frm:
            kw["from"] = frm
        if result is not None:
            kw["result"] = result
        d = self.call("updatePortalSyncRequest", **kw)
        if d.get("updated"):
            row["status"] = status
        return bool(d.get("updated"))


# ---------------------------------------------------------------- steps

def recover(rows, api):
    """A request still in 'sap' / 'portal' at the start of a round was left half-way (bot
    restarted, or the website could not be reached to save the next step). SAP half-way must be
    checked by a person; the portal step is safe to repeat (it never invites twice)."""
    for row in rows:
        name = f"{row['unitCode']} {row['phone']}"
        if row["status"] == "sap":
            api.update(row, "failed", "The bot was interrupted while updating SAP - check this "
                                      "unit in SAP by hand, then send it again", frm="sap")
            log(f"FAILED {name}: interrupted during SAP")
        elif row["status"] == "portal":
            api.update(row, "sap_done", "Portal step interrupted - trying again", frm="portal")


_sap_problem = {}   # request id -> last SAP login problem shown (written once, not every loop)


def handle_sap(api, config, row, sap):
    code, phone = row["unitCode"], row["phone"]
    if sap.broken:
        if _sap_problem.get(row["id"]) != sap.broken:
            api.update(row, "waiting", f"SAP login problem - waiting: {sap.broken}", frm="waiting")
            _sap_problem[row["id"]] = sap.broken
        return
    if not api.update(row, "sap", "Updating SAP…", frm="waiting"):
        return  # cancelled meanwhile
    try:
        sap.ensure()
    except sap_session.SapLoginError as e:
        api.update(row, "waiting", f"SAP login problem - waiting: {e}", frm="sap")
        _sap_problem[row["id"]] = str(e)
        log(f"SAP LOGIN PROBLEM - {code} {phone} stays waiting: {e}")
        return
    try:
        try:
            old = sap_b1.update_unit_phone(config, code, phone)
        except sap_b1.PortalSyncError:
            raise  # SAP itself saved fine and is clean - keep it open
        except Exception as e:
            shot = sap.after_error(code)
            raise sap_b1.SapError(f"{e} (SAP closed without saving; screenshot: "
                                  f"{os.path.basename(shot) if shot else 'none'})") from e
        api.update(row, "sap_done", f"SAP updated (was {old or 'empty'}) - portal next", frm="sap")
        log(f"SAP updated {code}: {old} -> {phone}")
    except Exception as e:
        api.update(row, "failed", f"SAP: {e}", frm="sap")
        log(f"FAILED {code} {phone}: {e}")


_portal_waiting = {}  # request id -> last "try later" reason


RESULT_TEXT = {
    "invited": "Invitation sent - Invitation Pending",
    "already activated": "Already Activated in the portal - nothing to do",
    "already invited": "Already Invitation Pending in the portal - not invited twice",
}


def handle_portal(api, context, row):
    code, phone = row["unitCode"], row["phone"]
    if not api.update(row, "portal", "Portal: searching the number…", frm="sap_done"):
        return
    try:
        result = portal.send_invitation(context, phone)
        api.update(row, "done", RESULT_TEXT.get(result, result), frm="portal", result=result)
        _portal_waiting.pop(row["id"], None)
        log(f"Done {code} {phone}: {result}")
    except portal.PortalWait as e:
        api.update(row, "sap_done", f"Portal not ready - will try again: {e}", frm="portal")
        if _portal_waiting.get(row["id"]) != str(e):
            log(f"Portal not ready - {code} {phone} waits: {e}")
        _portal_waiting[row["id"]] = str(e)
    except Exception as e:
        _portal_waiting.pop(row["id"], None)
        api.update(row, "failed", f"Portal: {e}", frm="portal")
        log(f"FAILED {code} {phone}: {e}")


def process(api, context, config, sap):
    """SAP for every waiting request, close SAP (it glitches when left open), then the portal."""
    rows = api.work()
    if any(r["status"] in ("sap", "portal") for r in rows):
        recover(rows, api)  # nothing runs between rounds, so these were left half-way
    waiting = [r for r in rows if r["status"] == "waiting"]
    if waiting:
        try:
            for row in waiting:
                handle_sap(api, config, row, sap)
        finally:
            sap.close()
        rows = api.work()
    for row in rows:
        if row["status"] == "sap_done":
            handle_portal(api, context, row)


def heartbeat(api, stop):
    while not stop.wait(HEARTBEAT):
        try:
            api.call("getPortalSyncWork")
        except Exception:
            pass


def main():
    from playwright.sync_api import sync_playwright
    config = load_config()
    api = Website()
    api.login()
    sap = sap_session.SapSession(log)
    stop = threading.Event()
    threading.Thread(target=heartbeat, args=(api, stop), daemon=True).start()
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(PROFILE_DIR, channel="msedge", headless=False)
        log("Website bot started - waiting for Sync to portal requests")
        error_shown = None
        try:
            while True:
                try:
                    process(api, context, config, sap)
                    error_shown = None
                except Exception as e:
                    if str(e) != error_shown:  # e.g. no internet: log once, keep trying
                        log(f"Problem (will keep trying): {e}")
                        error_shown = str(e)
                time.sleep(EVERY)
        finally:
            stop.set()


if __name__ == "__main__":
    if sys.argv[1:] == ["save-login"]:
        save_login()
    elif not sys.argv[1:]:
        main()
    else:
        sys.exit(__doc__)
