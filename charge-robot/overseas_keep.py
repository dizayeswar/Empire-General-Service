"""Keep Overseas Integration Platform logged in. Never type a password."""
from __future__ import annotations

import time

from pywinauto import Desktop

from pathlib import Path

from bot_switch import bot_is_on
from watch_open import log, nova_busy

SITE = "empire.pswla.com"
PAUSE = Path(__file__).resolve().parent / "logs" / "overseas_keep.pause"


def _edge():
    d = Desktop(backend="uia")
    for w in d.windows():
        title = w.window_text() or ""
        if "Overseas" in title:
            return w
        if "Edge" not in title:
            continue
        try:
            for c in w.descendants(control_type="Edit"):
                if SITE in (c.window_text() or ""):
                    return w
        except Exception:
            continue
    return None


def _named(win):
    out = []
    for c in win.descendants():
        name = (c.window_text() or "").strip()
        if name:
            out.append((c.element_info.control_type, name, c))
    return out


def _click_named(items, control: str, name: str) -> bool:
    for ctrl, text, el in items:
        if ctrl == control and text == name:
            try:
                el.invoke()
            except Exception:
                el.click_input()
            return True
    return False


def _is_login(items) -> bool:
    names = {text for _ctrl, text, _el in items}
    if "Sign In" in names and ("User Name" in names or "Password" in names):
        return True
    return False


def _is_logged_in(items) -> bool:
    names = {text for _ctrl, text, _el in items}
    return "Prepaid Function" in names and "STS Vending" in names


def _pay_open(items) -> bool:
    blob = " ".join(text for _c, text, _e in items)
    low = blob.lower()
    return "are you sure you want to pay" in low or "want to pay for" in low


def main() -> int:
    if PAUSE.exists():
        log("overseas keep paused")
        return 0
    on = bot_is_on()
    if on is False:
        log("BOT_OFF stop overseas keep")
        return 3
    if on is None:
        log("BOT_SWITCH unread — skip keep tick")
        return 0
    busy = nova_busy()
    if busy:
        log(f"WAIT {busy} — no overseas keep")
        return 0
    win = _edge()
    if win is None:
        log("overseas Edge not found")
        return 0
    items = _named(win)
    if _pay_open(items):
        log("WAIT overseas pay confirm — no Home")
        return 0
    if _is_login(items):
        time.sleep(1.5)
        items = _named(win)
        if _click_named(items, "Button", "Sign In"):
            log("overseas Sign In clicked (saved password, not typed)")
            return 0
        log("overseas login page but Sign In not found")
        return 0
    if _is_logged_in(items):
        if _click_named(items, "Hyperlink", "Home"):
            log("overseas Home keep-awake")
            return 0
        log("overseas logged in but Home not found")
        return 0
    log("overseas page unknown — no click")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
