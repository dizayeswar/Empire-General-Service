"""Local sqlite queue so each WhatsApp message is handled exactly once."""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "queue.db")

# new -> confirmed -> sap_done -> invited   (or failed / unreadable / rejected)


def connect(path=DB_PATH):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("""CREATE TABLE IF NOT EXISTS requests (
        message_id TEXT PRIMARY KEY,
        sender     TEXT,
        text       TEXT,
        code       TEXT,
        phone      TEXT,
        status     TEXT NOT NULL,
        error      TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    return db


def add(db, message_id, sender, text, parsed):
    """Insert a new message; returns False if it was already seen."""
    status = "new" if parsed else "unreadable"
    cur = db.execute(
        "INSERT OR IGNORE INTO requests (message_id, sender, text, code, phone, status) VALUES (?,?,?,?,?,?)",
        (message_id, sender, text, parsed and parsed["code"], parsed and parsed["phone"], status))
    db.commit()
    return cur.rowcount == 1


def pending(db):
    return db.execute(
        "SELECT * FROM requests WHERE status IN ('new','confirmed','sap_done') ORDER BY created_at").fetchall()


def set_status(db, message_id, status, error=None):
    db.execute("UPDATE requests SET status=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE message_id=?",
               (status, error, message_id))
    db.commit()
