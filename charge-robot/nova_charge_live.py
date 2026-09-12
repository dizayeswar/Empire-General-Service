"""Live charge for an already-open Payment management search. No password typing."""
from __future__ import annotations

import sys
import time

from pywinauto.mouse import click

from nova_login import handle_login_locked
from nova_search_filter import find_win, grab_invoice, shot
from robot import NovaSysRobot

APARTMENT = sys.argv[1] if len(sys.argv) > 1 else ""
TARIFF = sys.argv[2] if len(sys.argv) > 2 else ""
AMOUNT = sys.argv[3] if len(sys.argv) > 3 else ""


def main() -> None:
    from bot_switch import require_bot_on

    require_bot_on()
    if not APARTMENT or TARIFF not in {"T1", "T2"} or not AMOUNT:
        raise SystemExit("usage: nova_charge_live.py ES-3-5-01 T2 50000")
    bot = NovaSysRobot()
    bot.connect()
    handle_login_locked(4)
    win = find_win()
    win.set_focus()
    time.sleep(0.15)
    r = win.rectangle()
    click(coords=(r.left + 818, r.top + 294))
    time.sleep(0.3)

    pay = bot._main().child_window(title="Pay", control_type="Button")
    pay.wait("exists", timeout=6)
    rect = pay.rectangle()
    print("Pay button", rect)
    click(coords=(rect.right - 10, (rect.top + rect.bottom) // 2))
    time.sleep(0.45)
    click(coords=(rect.left + 36, rect.bottom + 36))
    print("Clicked Pay -> Automatic")
    time.sleep(0.5)
    handle_login_locked(16)
    time.sleep(0.5)

    dlg = bot._create_payment_dialog()
    bot._set_tariff(dlg, TARIFF)
    bot._set_amount(dlg, AMOUNT)
    bot._require_payment_matches(dlg, TARIFF, AMOUNT, APARTMENT)
    before = shot(win, f"BEFORE-PAY-{APARTMENT}-{TARIFF}-{AMOUNT}")
    print("before-pay", before)
    print("CLICKING PAY NOW", APARTMENT, TARIFF, AMOUNT)
    bot._require_payment_matches(dlg, TARIFF, AMOUNT, APARTMENT)
    bot._click_dialog_pay(dlg)
    handle_login_locked(8)
    bot._maximize_invoice()
    receipt = grab_invoice(f"INVOICE-{APARTMENT}")
    print("receipt", receipt)
    print("STEPS", bot.notes)


if __name__ == "__main__":
    main()
