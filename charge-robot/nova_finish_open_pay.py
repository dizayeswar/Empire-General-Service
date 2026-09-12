"""Finish an already-open Create payment dialog. Dropdown tariff only. No Pay if mismatch."""
from __future__ import annotations

import sys

from nova_search_filter import find_win, grab_invoice, shot
from robot import NovaSysRobot

APARTMENT = sys.argv[1]
TARIFF = sys.argv[2]
AMOUNT = sys.argv[3]


def main() -> None:
    from bot_switch import require_bot_on

    require_bot_on()
    bot = NovaSysRobot()
    bot.connect()
    dlg = bot._create_payment_dialog()
    bot._set_tariff(dlg, TARIFF)
    bot._set_amount(dlg, AMOUNT)
    bot._require_payment_matches(dlg, TARIFF, AMOUNT, APARTMENT)
    before = shot(find_win(), f"BEFORE-PAY-{APARTMENT}-{TARIFF}-{AMOUNT}")
    print("before-pay", before)
    print("shown", bot._read_tariff(dlg), bot._read_amount(dlg))
    bot._require_payment_matches(dlg, TARIFF, AMOUNT, APARTMENT)
    print("CLICKING PAY NOW", APARTMENT, TARIFF, AMOUNT)
    bot._click_dialog_pay(dlg)
    bot._maximize_invoice()
    print("receipt", grab_invoice(f"INVOICE-{APARTMENT}"))
    print("STEPS", bot.notes)


if __name__ == "__main__":
    main()
