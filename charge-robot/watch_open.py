"""Laptop Open-list watcher. One dump per tick. Named phone screens. Oldest RU first."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from phone_screen import (
    adb,
    clear_open_search,
    dismiss_sleep_clock,
    dump_screen,
    dump_texts,
    empire_focused,
    is_exit,
    is_pin_pad,
    is_sign_in,
    is_sleep_clock,
    reopen_empire,
    tap_navigate_up,
    tap_staff,
    tap_staff_sign_in,
    tap_xy,
)

ROOT = Path(__file__).resolve().parent
DIR = ROOT / "logs" / "phone-ui"
STATE = ROOT / "logs" / "watch_state.json"
LOG = ROOT / "logs" / "watch.log"
HOLD_FILE = ROOT / "hold_units.json"
HOLD_FILE_LOG = ROOT / "logs" / "hold_units.json"
DIR.mkdir(parents=True, exist_ok=True)
(ROOT / "logs").mkdir(parents=True, exist_ok=True)

# Extra hardcoded holds. Prefer logs/hold_units.json.
HOLD_UNITS: set[str] = set()

WAKE = (
    "AGENT_LOOP_WAKE_new_rus "
    '{"prompt":"NEW chargeable Open RU(s) on the Empire phone. Bot Off = stop '
    "(no Pay, no SET PIN). Nova and overseas, one RU at a time, oldest first. "
    "Overseas = STS Vending. Green circle+tick for Nova only. Pay / Recharge only if "
    'unit and amount match, then invoice, PIN Charged, SET PIN, Ok. Cards: %s"}'
)
OVERSEAS_LIVE = ROOT / "overseas_live.on"
LOG_KEEP = 1500
ALERTED_KEEP = 80


def tap(x: int, y: int) -> None:
    tap_xy(x, y)


def is_exit_texts(texts: list[str]) -> bool:
    return is_exit(texts)


def phone_has_pin_pad(texts: list[str] | None = None) -> bool:
    if texts is None:
        texts = dump_texts("lock-check")
    return is_pin_pad(texts)


def phone_is_locked(texts: list[str] | None = None) -> bool:
    return phone_has_pin_pad(texts)


def phone_on_login(texts: list[str] | None = None) -> bool:
    if texts is None:
        texts = dump_texts("login-check")
    return is_sign_in(texts)


def phone_sleep_clock(texts: list[str] | None = None) -> bool:
    if texts is None:
        texts = dump_texts("clock-check")
    return is_sleep_clock(texts)


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
            "Customer Name search icon not found",
            "Customer Selector box not found",
            "Customer Selector search icon",
            "STS Vending not found",
            "Amount box not found",
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
    return dump_screen(name).texts


def load_holds() -> set[str]:
    extra = {u.strip().upper().replace(" ", "") for u in HOLD_UNITS if u}
    for path in (HOLD_FILE, HOLD_FILE_LOG):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                extra |= {str(u).strip().upper().replace(" ", "") for u in data if str(u).strip()}
        except Exception:
            pass
    return extra


def unit_on_hold(unit: str) -> bool:
    """Do not Pay / Recharge these units until the hold is lifted."""
    return (unit or "").strip().upper().replace(" ", "") in load_holds()


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


def card_money(card: dict) -> float:
    try:
        return float((card.get("money") or "0").replace(",", "") or 0)
    except ValueError:
        return 0.0


def is_bad_card(card: dict) -> bool:
    unit = (card.get("unit") or "").strip()
    return (not unit) or card_money(card) <= 0


def leave_request_detail(texts: list[str]) -> list[str]:
    ui = dump_screen("watch-back")
    if ui.kind == "detail":
        tap_navigate_up(ui.nodes)
        time.sleep(0.7)
        ui = dump_screen("watch-back0")
    return ui.texts


def is_staff_open(texts: list[str]) -> bool:
    from phone_screen import is_open_list

    return is_open_list(texts)


def wait_open_ready(name: str, timeout: float = 16.0) -> list[str]:
    t0 = time.time()
    n = 0
    ui = dump_screen(name)
    while time.time() - t0 < timeout:
        if ui.kind == "open":
            return ui.texts
        if ui.kind in {"loading", "hello", "open_filter", "detail"}:
            ui = settle_open(f"{name}{n}" if n else name)
            if ui.kind == "open":
                return ui.texts
            time.sleep(0.6)
            n += 1
            continue
        break
    return ui.texts


def go_requests() -> list[str]:
    ui = dump_screen("go-req")
    tap_staff(ui.nodes, "Requests")
    time.sleep(1.1)
    return wait_open_ready("watch", 16.0)


def settle_open(
    name: str = "watch",
    *,
    leave_detail: bool = True,
    clear_filter: bool = True,
):
    """Drive the phone to a clean Open list. One dump first; more only after a tap."""
    if not empire_focused():
        log("phone left Empire — reopen app, no Home tap")
        reopen_empire()
    ui = dump_screen(name)
    for i in range(8):
        kind = ui.kind
        if kind == "pin_pad":
            log("phone PIN pad — no tap, no type")
            return ui
        if kind == "clock":
            log("sleep clock — swipe open, no password")
            dismiss_sleep_clock()
            time.sleep(0.8)
            ui = dump_screen(f"{name}-clock{i}")
            continue
        if kind == "sign_in":
            log("Empire Sign In — tap SIGN IN, no type")
            tap_staff_sign_in(ui)
            ui = dump_screen(f"{name}-signin{i}")
            if ui.kind == "sign_in":
                log("Empire Sign In still up — no type")
                return ui
            continue
        if kind == "detail":
            if not leave_detail:
                return ui
            tap_navigate_up(ui.nodes)
            time.sleep(0.7)
            ui = dump_screen(f"{name}-back{i}")
            continue
        if kind == "hello":
            tap_staff(ui.nodes, "Requests")
            time.sleep(1.1)
            ui = dump_screen(f"{name}-hello{i}")
            continue
        if kind == "open_filter":
            if not clear_filter:
                return ui
            log("Open search filter — clear")
            clear_open_search(ui)
            time.sleep(0.8)
            ui = dump_screen(f"{name}-clear{i}")
            continue
        if kind == "loading":
            time.sleep(1.1)
            ui = dump_screen(f"{name}-load{i}")
            continue
        if kind == "open":
            return ui
        if kind == "unknown" and not empire_focused():
            reopen_empire()
            ui = dump_screen(f"{name}-reopen{i}")
            continue
        if kind == "unknown" and "Hello" not in ui.texts and "Open" not in ui.texts:
            tap_staff(ui.nodes, "Home")
            time.sleep(1.2)
            tap_staff(ui.nodes, "Requests")
            time.sleep(1.1)
            ui = dump_screen(f"{name}-nav{i}")
            continue
        return ui
    return ui


def refresh_open() -> list[str]:
    return settle_open("watch").texts


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
    try:
        if LOG.exists() and LOG.stat().st_size > 400_000:
            lines = LOG.read_text(encoding="utf-8").splitlines()
            LOG.write_text("\n".join(lines[-LOG_KEEP:]) + "\n", encoding="utf-8")
    except Exception:
        pass


_LAST_AWAKE = 0.0


def keep_screen_awake() -> None:
    """Keep the display on. Factory default is 30s; Stay awake dies when USB charge drops."""
    global _LAST_AWAKE
    now = time.time()
    if now - _LAST_AWAKE < 20:
        return
    _LAST_AWAKE = now
    adb("shell", "settings", "put", "system", "screen_off_timeout", "2147483647")
    adb("shell", "settings", "put", "global", "stay_on_while_plugged_in", "15")
    adb("shell", "svc", "power", "stayon", "true")
    adb("shell", "input", "keyevent", "224")


def clear_idle_leftovers(busy: str) -> bool:
    """Idle loop only — PLANB is not running. Close leftover charge windows so Open can refresh."""
    if busy not in ("overseas invoice", "STS Vending", "Invoice", "Customer Selector", "Edit Photo"):
        return False
    log(f"leftover {busy} — close so phone Open can refresh")
    try:
        if busy == "Edit Photo":
            tap(79, 79)
            time.sleep(0.4)
            adb("shell", "input", "keyevent", "4")
            time.sleep(0.8)
            return True
        if busy == "Invoice":
            from pywinauto import Desktop

            d32 = Desktop(backend="win32")
            inv = d32.window(title="Invoice")
            if inv.exists(timeout=0.4) and inv.is_visible():
                try:
                    inv.close()
                except Exception:
                    pass
        else:
            from overseas_charge import click_home, close_pdf_tab, close_sts_tab, edge

            close_pdf_tab()
            win = edge()
            close_sts_tab(win)
            click_home(edge())
    except Exception as exc:
        log(f"leftover close failed {exc}")
        return False
    return True


def nova_busy() -> str:
    """Invoice, Create payment, or an in-progress SET PIN = do not start another RU."""
    lock = ROOT / "logs" / "setpin.lock"
    try:
        if lock.exists() and time.time() - lock.stat().st_mtime < 180:
            return "SET PIN"
    except Exception:
        pass
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


def _save_alerted(alerted: set) -> None:
    state = load_state()
    items = sorted(alerted)
    state["alerted"] = items[-ALERTED_KEEP:]
    save_state(state)


def _mark_bad(rus: list[str]) -> None:
    if not rus:
        return
    state = load_state()
    skipped = list(state.get("skipped_bad") or [])
    for ru in rus:
        if ru not in skipped:
            skipped.append(ru)
            log(f"SKIP bad card {ru}")
    state["skipped_bad"] = skipped[-ALERTED_KEEP:]
    save_state(state)


def _charge_busy() -> str:
    busy = nova_busy()
    if not busy and overseas_live():
        busy = overseas_busy()
    if not busy:
        focus = adb("shell", "dumpsys", "window")
        for ln in focus.splitlines():
            if "mCurrentFocus" in ln and "UCropActivity" in ln:
                return "Edit Photo"
    return busy


def main() -> int:
    from bot_switch import bot_is_on

    last_empty_log = 0.0
    last_live_log = 0.0
    while True:
        from charge_easy import load_need_pin

        need = load_need_pin()
        leftover = bool(need and need.get("ru"))
        keep_screen_awake()
        on = bot_is_on()
        if on is False:
            log("BOT_OFF stop (no refresh, no PLANB, no Pay, no SET PIN)")
            return 3
        if on is None and not leftover:
            now = time.time()
            if now - last_empty_log >= 20:
                log("BOT_SWITCH unread — no PLANB this tick")
                last_empty_log = now
            time.sleep(2)
            continue

        if overseas_live() and time.time() - last_live_log >= 30:
            log("OVERSEAS LIVE")
            last_live_log = time.time()

        busy = _charge_busy()
        if busy:
            if leftover:
                time.sleep(2)
                continue
            if clear_idle_leftovers(busy):
                time.sleep(1.2)
                continue
            log(f"WAIT {busy} still open — no next RU")
            time.sleep(2)
            continue

        if leftover:
            ui = settle_open("leftover", leave_detail=False, clear_filter=False)
            if ui.kind == "pin_pad":
                log("phone PIN pad — no tap, no type")
                time.sleep(20)
                continue
            ru = need["ru"]
            unit = need.get("unit") or ""
            started = need.get("started_at") or ""
            log(f"SET PIN leftover {ru} {unit} — Pay already done")
            script = (
                "overseas_charge.py"
                if need.get("source") == "overseas" or is_overseas(unit)
                else "charge_easy.py"
            )
            r = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / script),
                    ru,
                    unit,
                    started,
                    "--pin-only",
                ],
                cwd=str(ROOT),
            )
            if r.returncode == 3:
                return 3
            if r.returncode in (4, 6):
                log(f"SET PIN leftover {ru} retry next tick")
            return 10

        ui = settle_open("watch")
        if ui.kind == "pin_pad":
            time.sleep(20)
            continue
        if ui.kind != "open":
            now = time.time()
            if now - last_empty_log >= 20:
                log(f"phone {ui.kind} — no PLANB this tick")
                last_empty_log = now
            time.sleep(2)
            continue

        texts = ui.texts
        cards = parse_cards(texts)
        overseas = [c for c in cards if is_overseas(c.get("unit") or "")]
        if overseas_live():
            chargeable = [c for c in cards if c.get("ru")]
        else:
            chargeable = [c for c in cards if c.get("ru") and not is_overseas(c.get("unit") or "")]
        bad = [c for c in chargeable if is_bad_card(c)]
        if bad:
            _mark_bad([c["ru"] for c in bad if c.get("ru")])
        chargeable = [c for c in chargeable if not is_bad_card(c)]
        held = [c for c in chargeable if unit_on_hold(c.get("unit") or "")]
        if held:
            log("HOLD skip " + " ".join(f"{c.get('ru')} {c.get('unit')}" for c in held))
        chargeable = [c for c in chargeable if not unit_on_hold(c.get("unit") or "")]
        state = load_state()
        alerted = set(state.get("alerted") or [])
        fresh = [c for c in chargeable if c["ru"] not in alerted]

        now = time.time()
        if fresh or now - last_empty_log >= 20:
            log(
                f"open={len(cards)} chargeable={len(chargeable)} overseas={len(overseas)} "
                f"new={len(fresh)} buys={[c.get('ru') for c in cards]}"
            )
            last_empty_log = now

        if not fresh:
            time.sleep(3)
            continue

        c = fresh[-1]
        alerted.add(c["ru"])
        _save_alerted(alerted)
        summary = f"{c['ru']} {c.get('unit') or '?'} {c.get('money') or '?'}"
        log(f"PLANB {summary}")
        started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        script = "overseas_charge.py" if is_overseas(c.get("unit") or "") else "charge_easy.py"
        r = subprocess.run(
            [
                sys.executable,
                str(ROOT / script),
                c["ru"],
                c.get("unit") or "",
                started,
            ],
            cwd=str(ROOT),
        )
        if r.returncode == 3:
            return 3
        if r.returncode == 4:
            alerted.discard(c["ru"])
            _save_alerted(alerted)
            log(f"PLANB retry next tick {c['ru']}")
            return 10
        if r.returncode == 5:
            alerted.discard(c["ru"])
            _save_alerted(alerted)
            log(f"PLANB retry after Exit/nav {c['ru']}")
            return 10
        if r.returncode == 6:
            log(f"SET PIN leftover {c['ru']} — retry PIN only, no second Pay")
            return 10
        if r.returncode not in (0, 2):
            alerted.discard(c["ru"])
            _save_alerted(alerted)
            log(f"PLANB {script} exit {r.returncode}")
            return 10
        settle_open("after-charge")
        return 10


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"ERROR {exc}")
        raise SystemExit(1)
