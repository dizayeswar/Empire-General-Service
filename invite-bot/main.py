"""Apartment invite bot: WhatsApp -> SAP Business One -> Empire portal.

  python main.py --dry-run     read WhatsApp, print what would happen
  python main.py --confirm     ask y/n before each apartment (default)
  python main.py --auto        no questions, only problems are reported
"""
import argparse
import datetime
import json
import os
import time

from playwright.sync_api import sync_playwright

import portal
import queue_db
import sap_b1
import sap_session
import whatsapp
from parser import parse_message

HERE = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(HERE, "profiles", "edge")
LOG_PATH = os.path.join(HERE, "log.txt")


def log(msg):
    line = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_config():
    path = os.path.join(HERE, "config.local.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def handle_sap(db, config, row, mode, sap):
    code, phone, mid = row["code"], row["phone"], row["message_id"]
    if sap.broken:
        return  # SAP login is broken: the apartment stays waiting until the bot is restarted

    if row["status"] == "new":
        if mode == "confirm":
            answer = input(f"\n{code}  ->  {phone}   (from {row['sender']})   Save? [y/n] ").strip().lower()
            if answer != "y":
                queue_db.set_status(db, mid, "rejected")
                log(f"Rejected {code} {phone}")
                return
        queue_db.set_status(db, mid, "confirmed")

    try:
        sap.ensure()
    except sap_session.SapLoginError as e:
        log(f"SAP LOGIN PROBLEM - {code} {phone} stays waiting: {e}")
        return

    try:
        try:
            old = sap_b1.update_unit_phone(config, code, phone)
        except sap_b1.PortalSyncError:
            raise  # SAP itself saved fine and is clean - keep it open
        except Exception as e:
            shot = sap.after_error(code)
            raise sap_b1.SapError(f"{e} (SAP closed without saving; screenshot: {shot})") from e
        queue_db.set_status(db, mid, "sap_done")
        log(f"SAP updated {code}: {old} -> {phone}")
    except Exception as e:
        queue_db.set_status(db, mid, "failed", str(e))
        log(f"FAILED {code} {phone}: {e}")


_portal_waiting = {}  # message_id -> last "try later" reason (logged once, not every loop)


def handle_portal(db, context, row):
    code, phone, mid = row["code"], row["phone"], row["message_id"]
    try:
        result = portal.send_invitation(context, phone)
        queue_db.set_status(db, mid, "invited")
        _portal_waiting.pop(mid, None)
        log({"invited": f"Invitation sent {code} {phone}",
             "already activated": f"Done {code} {phone}: already Activated in the portal",
             "already invited": f"Done {code} {phone}: already Invitation Pending in the portal",
             }.get(result, f"Done {code} {phone}: {result}"))
    except portal.PortalWait as e:
        if _portal_waiting.get(mid) != str(e):
            log(f"Portal not ready - {code} {phone} waits: {e}")
        _portal_waiting[mid] = str(e)
    except Exception as e:
        _portal_waiting.pop(mid, None)
        queue_db.set_status(db, mid, "failed", str(e))
        log(f"FAILED {code} {phone}: {e}")


def main():
    ap = argparse.ArgumentParser()
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_const", dest="mode", const="dry-run")
    group.add_argument("--confirm", action="store_const", dest="mode", const="confirm")
    group.add_argument("--auto", action="store_const", dest="mode", const="auto")
    ap.add_argument("--every", type=int, default=30, help="seconds between WhatsApp checks")
    args = ap.parse_args()
    mode = args.mode or "confirm"
    config = load_config()
    db = queue_db.connect()
    sap = sap_session.SapSession(log)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(PROFILE_DIR, channel="msedge", headless=False)
        page = whatsapp.open_whatsapp(context)
        log(f"Started in {mode} mode")
        while True:
            try:
                for m in whatsapp.read_new_messages(page, config.get("only_unknown_numbers", True)):
                    parsed = parse_message(m["text"])
                    if dry_run_print(mode, m, parsed):
                        continue
                    if queue_db.add(db, m["message_id"], m["sender"], m["text"], parsed):
                        log(f"New message from {m['sender']}: "
                            + (f"{parsed['code']} {parsed['phone']}" if parsed else f"UNREADABLE: {m['text']!r}"))
            except Exception as e:
                log(f"WhatsApp read error: {e}")

            if mode != "dry-run":
                process_queue(db, context, config, mode, sap)
            time.sleep(args.every)


def process_queue(db, context, config, mode, sap):
    """SAP for every waiting apartment, close SAP (it glitches when left open), then the portal
    (which can wait minutes for a new number to show up - SAP is already closed by then)."""
    try:
        for row in queue_db.pending(db):
            if row["status"] in ("new", "confirmed"):
                handle_sap(db, config, row, mode, sap)
    finally:
        sap.close()
    for row in queue_db.pending(db):
        if row["status"] == "sap_done":
            handle_portal(db, context, row)


def dry_run_print(mode, m, parsed):
    """In dry-run nothing is saved; just show what was understood."""
    if mode != "dry-run":
        return False
    if parsed:
        print(f"{m['sender']}: {parsed['code']} -> {parsed['phone']}")
        sap_b1.update_unit_phone({}, parsed["code"], parsed["phone"], dry_run=True)
        portal.send_invitation(None, parsed["phone"], dry_run=True)
    else:
        print(f"{m['sender']}: UNREADABLE {m['text']!r}")
    return True


if __name__ == "__main__":
    main()
