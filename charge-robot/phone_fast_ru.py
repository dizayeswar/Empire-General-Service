"""Open Requests, search one RU, print texts. Clear leftover search first."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from phone_screen import (
    adb,
    clear_open_search,
    dismiss_sleep_clock,
    dump_screen,
    tap_buy_card,
    tap_staff,
    tap_staff_sign_in,
)

DIR = Path(__file__).resolve().parent / "logs" / "phone-ui"
DIR.mkdir(parents=True, exist_ok=True)


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def click_ok_if_done(ui):
    if "Request Completed" in ui.texts or "Request was completed successfully!" in ui.texts:
        from phone_screen import tap_text

        if not tap_text(ui.nodes, "Ok"):
            tap(827, 1313)
        time.sleep(0.35)
        return dump_screen("fast-ok")
    return ui


def main() -> None:
    from bot_switch import require_bot_on
    from charge_easy import load_need_pin

    ru = sys.argv[1]
    ui = click_ok_if_done(dump_screen("fast0"))
    if ui.kind == "sign_in":
        tap_staff_sign_in(ui)
        ui = click_ok_if_done(dump_screen("fast0-signin"))
        if ui.kind == "sign_in":
            print("EMPIRE SIGN IN still up — no type")
            raise SystemExit("empire sign in")
    if ui.kind == "pin_pad":
        print("PHONE PIN PAD — no tap, no type")
        raise SystemExit("phone PIN pad")
    if ui.kind == "clock":
        dismiss_sleep_clock()
        ui = click_ok_if_done(dump_screen("fast0-swipe"))
        if ui.kind in {"pin_pad", "clock"}:
            print("PHONE still on clock/PIN after swipe")
            raise SystemExit("phone still asleep")
    need = load_need_pin()
    require_bot_on(allow_unread=bool(need and need.get("ru") == ru))
    if ru in ui.texts and (
        "Request ID" in ui.texts or "Request Detail" in ui.texts or "SET PIN" in ui.texts
    ):
        print("ALREADY OPEN")
        for t in ui.texts:
            print(t)
        return
    if ui.kind == "open_filter":
        buys = [t for t in ui.texts if t.startswith("Buy -")]
        if len(buys) == 1 and buys[0] == f"Buy - {ru}":
            if tap_buy_card(ui.nodes, ru):
                time.sleep(1.2)
                ui = dump_screen("fast-open")
                print("OPEN")
                for t in ui.texts:
                    print(t)
                return
        print("clear leftover Open search")
        clear_open_search(ui)
        time.sleep(0.8)
        ui = dump_screen("fast-cleared")
    if ui.kind == "hello" or "Open" not in ui.texts or not any(
        t.startswith("Buy -") or t == "Getting Requests..." for t in ui.texts
    ):
        tap_staff(ui.nodes, "Requests")
        time.sleep(1.0)
        for _ in range(8):
            ui = dump_screen("fast1")
            if ui.kind == "loading":
                time.sleep(0.7)
                continue
            break
    from phone_screen import find_id, tap_bounds

    box = find_id(ui.nodes, "et_search")
    if box:
        tap_bounds(box.bounds)
    else:
        tap(460, 369)
    time.sleep(0.25)
    adb("shell", "input", "keyevent", "123")
    for _ in range(12):
        adb("shell", "input", "keyevent", "67")
    adb("shell", "input", "text", ru)
    time.sleep(0.9)
    ui = dump_screen("fast-search")
    print("SEARCH")
    for t in ui.texts:
        print(t)
    if ru in ui.texts and (
        "Request ID" in ui.texts or "Request Detail" in ui.texts or "SET PIN" in ui.texts
    ):
        print("ALREADY OPEN")
        return
    buys = [t for t in ui.texts if t.startswith("Buy -")]
    if len(buys) != 1 or buys[0] != f"Buy - {ru}":
        raise SystemExit(f"not exactly one {ru}: {buys}")
    if not tap_buy_card(ui.nodes, ru):
        tap(540, 980)
    time.sleep(1.2)
    ui = dump_screen("fast-open")
    print("OPEN")
    for t in ui.texts:
        print(t)


if __name__ == "__main__":
    main()
