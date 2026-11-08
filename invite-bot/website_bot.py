"""Invite bot driven by the website: Application → Sync to portal.

A person types Unit Code + phone on the website and presses Send. This bot (always running on
the office PC, hidden - no window) asks the website for work every few seconds and, with no
questions:

  1. SAP for every waiting request - in its own short program (sap_job.py), which opens SAP,
     does them, closes SAP and exits. SAP hung on Update when the bot's black window and Edge
     were running in the same program (2026-11-08), so the bot has no window and SAP runs alone.
  2. Then the portal invitation, in the bot's Edge window - opened only for this step and
     closed again afterwards.

Each step is written back, so the page shows: Waiting → SAP updating → SAP done → Portal →
Done (Invited / Already activated / Already invited) or Failed with the reason.

  python website_bot.py save-login   once: the website account the bot uses (kept in Windows
                                     Credential Manager, not in any file)
  start-website-bot.bat              start (hidden); progress in log.txt and on the website
  stop-website-bot.bat               stop

The website account needs only Application → Sync to portal = Read/Write (Admin → Users).
"""
import datetime
import json
import os
import queue
import subprocess
import sys
import threading
import time
import urllib.request

import portal

HERE = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(HERE, "profiles", "edge")
LOG_PATH = os.path.join(HERE, "log.txt")
PYTHON = os.path.join(os.path.dirname(sys.executable), "python.exe")
API = "https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api"
CRED_TARGET = "EmpireInviteBot Website"
MUTEX_NAME = "Local\\EmpireInviteBotWebsite"
EVERY = 10             # seconds between "any work?" checks
HEARTBEAT = 20         # "Bot online" ping (from this program - SAP runs in its own one)
SAP_JOB_TIMEOUT = 10 * 60   # one apartment in SAP never takes this long; then SAP is stuck
TOKEN_ERRORS = ("No token", "Invalid token", "Token expired")
NO_WINDOW = 0x08000000      # CREATE_NO_WINDOW


def log(msg):
    line = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    if sys.stdout:  # None when started hidden (pythonw)
        print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


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


# ---------------------------------------------------------------- SAP step (separate program)

def run_sap_job(jobs):
    """Start sap_job.py with no window and yield its events. Kills SAP if it gets stuck."""
    proc = subprocess.Popen([PYTHON, os.path.join(HERE, "sap_job.py")], cwd=HERE,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, encoding="utf-8", creationflags=NO_WINDOW)
    proc.stdin.write(json.dumps(jobs))
    proc.stdin.close()
    lines = queue.Queue()
    threading.Thread(target=lambda: [lines.put(l) for l in proc.stdout] + [lines.put(None)],
                     daemon=True).start()
    while True:
        try:
            line = lines.get(timeout=SAP_JOB_TIMEOUT)
        except queue.Empty:
            proc.kill()
            subprocess.run(["taskkill", "/F", "/IM", "SAP Business One.exe"],
                           capture_output=True, check=False, creationflags=NO_WINDOW)
            yield {"event": "stuck"}
            return
        if line is None:
            break
        line = line.strip()
        if line.startswith("{"):
            yield json.loads(line)
    proc.wait()
    err = proc.stderr.read().strip()
    if proc.returncode:
        yield {"event": "crashed", "error": err.splitlines()[-1] if err else f"exit {proc.returncode}"}


class SapState:
    broken = None   # set after a refused SAP login: SAP is not tried again until the bot restarts


def sap_step(api, waiting, sap_state):
    """All waiting requests in one SAP run: open, update each, close."""
    if sap_state.broken:
        for row in waiting:
            if sap_state.broken not in row.get("message", ""):
                api.update(row, "waiting", f"SAP login problem - waiting: {sap_state.broken}", frm="waiting")
        return
    jobs, rows = [], {}
    for n, row in enumerate(waiting, start=1):
        if api.update(row, "sap", f"In the SAP queue ({n} of {len(waiting)})", frm="waiting"):
            jobs.append({"id": row["id"], "unitCode": row["unitCode"], "phone": row["phone"]})
            rows[row["id"]] = row
    if not jobs:
        return
    finished = set()
    for ev in run_sap_job(jobs):
        row = rows.get(ev.get("id"))
        kind = ev.get("event")
        if "log" in ev:
            log(ev["log"])
        elif kind == "start":
            api.update(row, "sap", "Updating SAP…", frm="sap")
        elif kind == "ok":
            api.update(row, "sap_done", f"SAP updated (was {ev.get('old') or 'empty'}) - portal next", frm="sap")
            log(f"SAP updated {row['unitCode']}: {ev.get('old')} -> {row['phone']}")
        elif kind == "portal_sync":
            api.update(row, "failed", f"SAP: {ev['error']}", frm="sap")
            log(f"FAILED {row['unitCode']} {row['phone']}: {ev['error']}")
        elif kind == "sap_error":
            api.update(row, "failed", f"SAP: {ev['error']} (SAP closed without saving; screenshot: "
                                      f"{ev.get('shot') or 'none'})", frm="sap")
            log(f"FAILED {row['unitCode']} {row['phone']}: {ev['error']}")
        elif kind == "login":
            sap_state.broken = ev["error"]
            api.update(row, "waiting", f"SAP login problem - waiting: {ev['error']}", frm="sap")
            log(f"SAP LOGIN PROBLEM - {row['unitCode']} {row['phone']} stays waiting: {ev['error']}")
        elif kind in ("stuck", "crashed"):
            why = ("SAP got stuck and was closed by force" if kind == "stuck"
                   else f"the SAP program stopped: {ev.get('error')}")
            for rid, r in rows.items():
                if rid not in finished:
                    api.update(r, "failed", f"SAP: {why} - check this unit in SAP by hand, then send "
                                            "it again", frm="sap")
            log(f"SAP PROBLEM: {why}")
            return
        if kind in ("ok", "portal_sync", "sap_error", "login"):
            finished.add(ev["id"])


# ---------------------------------------------------------------- portal step

RESULT_TEXT = {
    "invited": "Invitation sent - Invitation Pending",
    "already activated": "Already Activated in the portal - nothing to do",
    "already invited": "Already Invitation Pending in the portal - not invited twice",
}
_portal_waiting = {}  # request id -> last "try later" reason


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


_portal_retry_at = {}   # request id -> earliest next try after "Portal not ready"
PORTAL_RETRY = 60


def open_edge():
    """Start the bot's Edge window for the portal step. Returns (playwright, context)."""
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    try:
        return pw, pw.chromium.launch_persistent_context(PROFILE_DIR, channel="msedge", headless=False)
    except Exception:
        pw.stop()
        raise


def close_edge(pw, context):
    for f in (context.close, pw.stop):
        try:
            f()
        except Exception:
            pass


def portal_step(api, rows):
    now = time.time()
    due = [r for r in rows if r["status"] == "sap_done" and _portal_retry_at.get(r["id"], 0) <= now]
    if not due:
        return
    pw, context = open_edge()
    try:
        for row in due:
            handle_portal(api, context, row)
            if row["status"] == "sap_done":
                _portal_retry_at[row["id"]] = time.time() + PORTAL_RETRY
            else:
                _portal_retry_at.pop(row["id"], None)
    finally:
        close_edge(pw, context)


# ---------------------------------------------------------------- one round

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


class Heartbeat:
    """'Bot online' ping every HEARTBEAT seconds."""

    def __init__(self, api):
        self.api = api
        self.stop = threading.Event()
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while not self.stop.wait(HEARTBEAT):
            try:
                self.api.call("getPortalSyncWork")
            except Exception:
                pass


def process(api, sap_state):
    rows = api.work()
    if any(r["status"] in ("sap", "portal") for r in rows):
        recover(rows, api)  # nothing runs between rounds, so these were left half-way
    waiting = [r for r in rows if r["status"] == "waiting"]
    if waiting:
        sap_step(api, waiting, sap_state)
        rows = api.work()
    portal_step(api, rows)


def single_instance():
    """True if no other website bot runs on this PC (a second one would fight over SAP/Edge)."""
    import ctypes
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        return None
    return handle


def main():
    mutex = single_instance()
    if not mutex:
        log("Website bot is already running - this second start does nothing")
        return
    api = Website()
    api.login()
    sap_state = SapState()
    heartbeat = Heartbeat(api)
    log("Website bot started (hidden) - waiting for Sync to portal requests")
    error_shown = None
    try:
        while True:
            try:
                process(api, sap_state)
                error_shown = None
            except Exception as e:
                if str(e) != error_shown:  # e.g. no internet: log once, keep trying
                    log(f"Problem (will keep trying): {e}")
                    error_shown = str(e)
            time.sleep(EVERY)
    finally:
        heartbeat.stop.set()


if __name__ == "__main__":
    if sys.argv[1:] == ["save-login"]:
        save_login()
    elif not sys.argv[1:]:
        try:
            main()
        except Exception as e:
            log(f"Website bot STOPPED: {e}")
            raise
    else:
        sys.exit(__doc__)
