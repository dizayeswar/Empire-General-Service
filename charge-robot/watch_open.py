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
    "(no Pay, no SET PIN). Nova and overseas, one RU at a time, oldest first. "
    "Overseas = STS Vending. Green circle+tick for Nova only. Pay / Recharge only if "
    'unit and amount match, then invoice, PIN Charged, SET PIN, Ok. Cards: %s"}'
)
OVERSEAS_LIVE = ROOT / "overseas_live.on"


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=25)
    return (r.stdout or "") + (r.stderr or "")


def _dump_raw(name: str) -> list[str]:
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    dest = DIR / f"{name}.xml"
    adb("pull", "/sdcard/uidump.xml", str(dest))
    import xml.etree.ElementTree as ET

    root = ET.parse(dest).getroot()
    return [n.attrib.get("text") or "" for n in root.iter("node") if n.attrib.get("text")]


def dump_texts(name: str) -> list[str]:
    """Every dump taps NO if Exit Application is up, so Open RUs are not skipped."""
    return dismiss_exit(_dump_raw(name), name)


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def is_exit_texts(texts: list[str]) -> bool:
    return "Exit Application" in texts or "Are you Sure you want to exit?" in texts


def nav_should_retry(exc: BaseException) -> bool:
    """Exit / list-nav fail = retry this RU. Do not use after Pay (would recharge)."""
    msg = str(exc)
    return any(
        s in msg
        for s in (
            "Exit Application",
            "Are you Sure you want to exit?",
            "bad items",
            "not exactly one",
            "phone is not on",
            "returned non-zero exit status",
            "open RU-",
        )
    )


def _bounds_for_text(xml_name: str, label: str):
    import xml.etree.ElementTree as ET

    dest = DIR / f"{xml_name}.xml"
    if not dest.exists():
        return None
    root = ET.parse(dest).getroot()
    found = None
    for n in root.iter("node"):
        if n.attrib.get("text") != label:
            continue
        b = n.attrib.get("bounds") or ""
        nums = [
            int(x)
            for x in b.replace("][", ",").replace("[", "").replace("]", "").split(",")
            if x
        ]
        if len(nums) == 4:
            found = nums
    return found


def dismiss_exit(texts: list[str], name: str) -> list[str]:
    """Home-on-Home opens Exit Application. Tap NO until it is gone."""
    for i in range(4):
        if not is_exit_texts(texts):
            return texts
        b = _bounds_for_text(name, "NO")
        if not b:
            texts = _dump_raw(name)
            if not is_exit_texts(texts):
                return texts
            b = _bounds_for_text(name, "NO")
        if not b:
            log("Exit Application on screen but NO not found")
            return texts
        tap((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
        time.sleep(0.5)
        log("dismissed Exit Application (NO)")
        name = f"{name}-no{i}"
        texts = _dump_raw(name)
    return texts


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


def overseas_live() -> bool:
    return OVERSEAS_LIVE.exists()


def overseas_busy() -> str:
    """STS Vending, Customer Selector, pay confirm, or invoice PDF still open."""
    try:
        from pywinauto import Desktop

        d = Desktop(backend="uia")
        for w in d.windows():
            title = w.window_text() or ""
            if "rechargePrint" in title:
                return "overseas invoice"
            if "Overseas" not in title and "empire.pswla" not in title:
                continue
            for c in w.descendants():
                name = c.window_text() or ""
                ctrl = c.element_info.control_type
                low = name.lower()
                if ctrl == "TabItem" and name.startswith("STS Vending"):
                    return "STS Vending"
                if "rechargePrint" in name:
                    return "overseas invoice"
                if "are you sure you want to pay" in low or "want to pay for" in low:
                    return "overseas pay confirm"
                if "customer selector" in low:
                    return "Customer Selector"
    except Exception:
        pass
    return ""


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


def leave_request_detail(texts: list[str]) -> list[str]:
    """Request Detail / Items uses its own bottom tabs. Home (134,2144) and
    Requests (405,2144) hit those tabs and never reach the Open list."""
    texts = dismiss_exit(texts, "watch-back")
    for i in range(8):
        joined = " ".join(texts)
        stuck = (
            "Request ID" in texts
            or "SET PIN" in texts
            or ("Request Detail" in texts and "Buy - RU-" not in joined and "Open" not in texts)
        )
        if not stuck:
            return texts
        tap(79, 185)
        time.sleep(0.7)
        texts = dump_texts(f"watch-back{i}")
    return texts


def refresh_open() -> list[str]:
    texts = dump_texts("watch0")
    texts = leave_request_detail(texts)
    # Home while already on Hello opens Exit Application.
    if "Hello" not in texts and not is_exit_texts(texts):
        tap(134, 2144)
        time.sleep(2)
    tap(405, 2144)
    time.sleep(18)
    texts = dump_texts("watch")
    texts = leave_request_detail(texts)
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
        texts = leave_request_detail(texts)
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


def nova_busy() -> str:
    """Invoice or Create payment still open = do not start another RU."""
    try:
        from pywinauto import Desktop

        d32 = Desktop(backend="win32")
        for title in ("Invoice", "Create payment"):
            w = d32.window(title=title)
            if w.exists(timeout=0.2) and w.is_visible():
                return title
    except Exception:
        pass
    return ""


def main() -> int:
    from bot_switch import bot_is_on

    on = bot_is_on()
    if on is False:
        log("BOT_OFF stop (no refresh, no PLANB, no Pay, no SET PIN)")
        return 3
    if on is None:
        log("BOT_SWITCH unread — no PLANB this tick")
        return 0

    if overseas_live():
        log("OVERSEAS LIVE")

    busy = nova_busy()
    if not busy and overseas_live():
        busy = overseas_busy()
    if not busy:
        focus = adb("shell", "dumpsys", "window")
        for ln in focus.splitlines():
            if "mCurrentFocus" in ln and "UCropActivity" in ln:
                busy = "Edit Photo"
                break
    if busy:
        log(f"WAIT {busy} still open — no next RU")
        return 0

    texts = refresh_open()
    cards = parse_cards(texts)
    overseas = [c for c in cards if is_overseas(c.get("unit") or "")]
    if overseas_live():
        chargeable = [c for c in cards if c.get("ru")]
    else:
        chargeable = [c for c in cards if c.get("ru") and not is_overseas(c.get("unit") or "")]
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
            pass
        save_state({"alerted": sorted(alerted)})
        return 0

    # Visible list is newest at the top. Take the oldest card on this screen.
    c = fresh[-1]
    alerted.add(c["ru"])
    save_state({"alerted": sorted(alerted)})
    summary = f"{c['ru']} {c.get('unit') or '?'} {c.get('money') or '?'}"
    log(f"PLANB {summary}")
    script = "overseas_charge.py" if is_overseas(c.get("unit") or "") else "charge_easy.py"
    r = subprocess.run(
        [
            sys.executable,
            str(ROOT / script),
            c["ru"],
            c.get("unit") or "",
        ],
        cwd=str(ROOT),
    )
    if r.returncode == 3:
        return 3
    if r.returncode == 4:
        alerted.discard(c["ru"])
        save_state({"alerted": sorted(alerted)})
        log(f"PLANB retry next tick {c['ru']}")
        return 10
    if r.returncode == 5:
        alerted.discard(c["ru"])
        save_state({"alerted": sorted(alerted)})
        log(f"PLANB retry after Exit/nav {c['ru']}")
        return 10
    if r.returncode not in (0, 2):
        alerted.discard(c["ru"])
        save_state({"alerted": sorted(alerted)})
        log(f"PLANB {script} exit {r.returncode}")
        return 10
    return 10


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"ERROR {exc}")
        raise SystemExit(1)
