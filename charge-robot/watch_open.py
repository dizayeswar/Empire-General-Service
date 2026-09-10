"""Laptop Open-list watcher. Refreshes the phone every tick. Wakes Cursor only for new chargeable RUs."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIR = ROOT / "logs" / "phone-ui"
STATE = ROOT / "logs" / "watch_state.json"
LOG = ROOT / "logs" / "watch.log"
DIR.mkdir(parents=True, exist_ok=True)
(ROOT / "logs").mkdir(parents=True, exist_ok=True)

ADB = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "platform-tools/adb.exe"
)

WAKE = (
    "AGENT_LOOP_WAKE_new_rus "
    '{"prompt":"NEW chargeable Open RU(s) on the Empire phone. Bot Off = stop '
    "(no Pay, no SET PIN). Skip overseas RV-/RA-/WD-/WW-1..WW-11. One RU at a time, "
    "oldest first. Green circle+tick only. Dropdown T1/T2, confirm apartment/tariff/amount "
    'before Pay, invoice, PIN Charged, SET PIN, Ok. Target 3-5 min. Cards: %s"}'
)


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=25)
    return (r.stdout or "") + (r.stderr or "")


def dump_texts(name: str) -> list[str]:
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    dest = DIR / f"{name}.xml"
    adb("pull", "/sdcard/uidump.xml", str(dest))
    import xml.etree.ElementTree as ET

    root = ET.parse(dest).getroot()
    return [n.attrib.get("text") or "" for n in root.iter("node") if n.attrib.get("text")]


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def is_overseas(unit: str) -> bool:
    u = (unit or "").strip().upper().replace(" ", "")
    if not u:
        return False
    if u.startswith("RV-") or u.startswith("RA-") or u.startswith("WD-"):
        return True
    m = re.match(r"^WW-(\d+)(?:-|$)", u)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 11:
            return True
    return False


def parse_cards(texts: list[str]) -> list[dict]:
    cards: list[dict] = []
    current = {"date": "", "ru": "", "unit": "", "money": ""}
    for t in texts:
        if re.search(r"September-20|August-20|October-20|July-20|June-20", t) or re.match(
            r"^\d{2}-[A-Za-z]+-\d{4}$", t
        ):
            current["date"] = t
        if t.startswith("Buy - RU-"):
            current["ru"] = t.replace("Buy - ", "").strip()
        if t.startswith("Unit -"):
            current["unit"] = t.replace("Unit -", "").strip()
        if "IQD" in t and current["ru"]:
            current["money"] = t.replace("IQD", "").replace(",", "").strip()
        if current["ru"] and not any(c["ru"] == current["ru"] for c in cards):
            cards.append(dict(current))
        elif current["ru"]:
            for c in cards:
                if c["ru"] == current["ru"]:
                    if current["unit"]:
                        c["unit"] = current["unit"]
                    if current["money"]:
                        c["money"] = current["money"]
                    if current["date"]:
                        c["date"] = current["date"]
    return cards


def refresh_open() -> list[str]:
    tap(134, 2144)
    time.sleep(2)
    tap(405, 2144)
    time.sleep(18)
    texts = dump_texts("watch")
    if "Getting Requests..." in texts:
        time.sleep(10)
        texts = dump_texts("watchb")
    if "Hello" in texts or ("Open" not in texts and "Getting Requests..." not in texts):
        tap(405, 2144)
        time.sleep(14)
        texts = dump_texts("watchc")
        if "Getting Requests..." in texts:
            time.sleep(8)
            texts = dump_texts("watchd")
    return texts


def load_state() -> dict:
    if not STATE.exists():
        return {"alerted": []}
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {"alerted": []}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def log(msg: str) -> None:
    line = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
    print(line, file=sys.stderr)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def main() -> int:
    texts = refresh_open()
    cards = parse_cards(texts)
    chargeable = [c for c in cards if c.get("ru") and not is_overseas(c.get("unit") or "")]
    overseas = [c for c in cards if is_overseas(c.get("unit") or "")]
    state = load_state()
    alerted = set(state.get("alerted") or [])
    fresh = [c for c in chargeable if c["ru"] not in alerted]

    log(
        f"open={len(cards)} chargeable={len(chargeable)} overseas={len(overseas)} "
        f"new={len(fresh)} buys={[c.get('ru') for c in cards]}"
    )

    if not fresh:
        gone = [ru for ru in list(alerted) if ru not in {c["ru"] for c in chargeable}]
        if gone:
            # RU left Open (charged/closed). Keep in alerted so a unique RU is never re-woken.
            pass
        save_state({"alerted": sorted(alerted)})
        return 0

    for c in fresh:
        alerted.add(c["ru"])
    save_state({"alerted": sorted(alerted)})
    summary = "; ".join(
        f"{c['ru']} {c.get('unit') or '?'} {c.get('money') or '?'}" for c in fresh
    )
    print(WAKE % summary, flush=True)
    log(f"WAKE {summary}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"ERROR {exc}")
        raise SystemExit(1)
