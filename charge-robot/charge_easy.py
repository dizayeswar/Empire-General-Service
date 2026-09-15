"""Auto charge: fill Create payment, Pay only if boxes match, then attach + SET PIN."""
from __future__ import annotations

import re
import subprocess
import sys
import threading
import time
from pathlib import Path

from PIL import Image
from pywinauto.mouse import click

from nova_check_unit import search as nova_search
from nova_login import handle_login_locked
from nova_search_filter import find_win, grab_invoice, shot
from robot import NovaSysRobot

ROOT = Path(__file__).resolve().parent
ADB = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "platform-tools/adb.exe"
)


def wake(reason: str, detail: str) -> None:
    prompt = (
        "AUTO PAY. Bot Off = stop (no Pay, no SET PIN). "
        f"{reason} {detail}"
    )
    print(f"AGENT_LOOP_WAKE_new_rus {{\"prompt\":{prompt!r}}}", flush=True)
    print(f"HARD {reason} {detail}", flush=True)


def nova_query(unit: str) -> str:
    u = (unit or "").strip().upper()
    m = re.match(r"^ES-4-(\d+)-(\d+)$", u)
    if m:
        return f"ES4-{int(m.group(1))}-{int(m.group(2))}"
    m = re.match(r"^ES-6-(\d+)-(\d+)$", u)
    if m:
        return f"ES-6-{int(m.group(1))}-{int(m.group(2))}"
    return u


def items_from_phone(ru: str) -> tuple[str, str]:
    from watch_open import dump_texts

    last: Exception | None = None
    for attempt in range(2):
        r = subprocess.run(
            [sys.executable, str(ROOT / "phone_fast_ru.py"), ru],
            cwd=str(ROOT),
        )
        if r.returncode == 3:
            raise SystemExit(3)
        if r.returncode == 4:
            raise SystemExit(4)
        if r.returncode != 0:
            dump_texts(f"items-open-fail{attempt}")
            last = RuntimeError(f"open {ru} exit {r.returncode}")
            print("open retry", attempt + 1, last)
            continue
        adb = str(ADB)
        subprocess.run([adb, "shell", "input", "tap", "777", "2118"], timeout=20)
        time.sleep(1.2)
        texts = dump_texts("items-b")
        tariff = ""
        amount = ""
        for t in texts:
            up = t.upper()
            if "NATIONAL" in up:
                tariff = "T1"
            if "GENERATOR" in up:
                tariff = "T2"
            if t.startswith("IQD"):
                raw = t.replace("IQD", "").replace(",", "").strip()
                amount = raw.split(".")[0].strip()
        if tariff in {"T1", "T2"} and amount.isdigit():
            return tariff, amount
        last = RuntimeError(f"bad items tariff={tariff} amount={amount} texts={texts[:16]}")
        print("items retry", attempt + 1, last)
    assert last is not None
    raise last


def click_nova_refresh() -> None:
    """Toolbar Refresh next to Pay (also F5). One click only."""
    from pywinauto.keyboard import send_keys

    bot = NovaSysRobot()
    bot.connect()
    win = find_win()
    win.set_focus()
    time.sleep(0.15)
    try:
        btn = bot._main().child_window(title="Refresh", control_type="Button")
        if btn.exists(timeout=0.6) and btn.is_visible():
            btn.click_input()
            print("Clicked Nova Refresh")
            time.sleep(1.6)
            return
    except Exception:
        pass
    try:
        pay = bot._main().child_window(title="Pay", control_type="Button")
        pay.wait("exists", timeout=4)
        rect = pay.rectangle()
        click(coords=(rect.left - 28, (rect.top + rect.bottom) // 2))
        print("Clicked Nova Refresh beside Pay")
        time.sleep(1.6)
        return
    except Exception:
        pass
    send_keys("{F5}")
    print("Nova Refresh F5")
    time.sleep(1.6)


def icon_ok(verdict: str, shot_path: Path) -> bool:
    if verdict == "green":
        return True
    if verdict == "red_x":
        return False
    img = Image.open(shot_path).convert("RGB")
    red = green = grey = 0
    for y in range(276, 312):
        for x in range(8, 42):
            r, g, b = img.getpixel((x, y))
            if r > 200 and g < 90 and b < 90:
                red += 1
            elif g > 170 and g > r + 25:
                green += 1
            elif abs(r - g) < 18 and abs(g - b) < 18 and 90 < r < 190:
                grey += 1
    print(f"icon-recheck red={red} green={green} grey={grey}")
    return red == 0 and green >= 15


def _keep_request_awake(stop: threading.Event) -> None:
    """Wake the screen only. Do not tap Home — that leaves Request Detail."""
    adb = str(ADB)
    while not stop.wait(15):
        try:
            subprocess.run(
                [adb, "shell", "input", "keyevent", "224"],
                timeout=8,
                capture_output=True,
            )
        except Exception:
            pass


def charge_and_pay(apartment: str, tariff: str, amount: str) -> Path:
    from bot_switch import require_bot_on

    require_bot_on(fresh=True)
    bot = NovaSysRobot()
    bot.connect()
    handle_login_locked(6)
    win = find_win()
    win.set_focus()
    time.sleep(0.15)
    r = win.rectangle()
    click(coords=(r.left + 818, r.top + 294))
    time.sleep(0.3)
    pay = bot._main().child_window(title="Pay", control_type="Button")
    pay.wait("exists", timeout=6)
    rect = pay.rectangle()
    click(coords=(rect.right - 10, (rect.top + rect.bottom) // 2))
    time.sleep(0.45)
    click(coords=(rect.left + 36, rect.bottom + 36))
    print("Clicked Pay -> Automatic")
    time.sleep(0.5)
    handle_login_locked(16)
    time.sleep(0.5)
    dlg = bot._create_payment_dialog()
    bot._set_tariff(dlg, tariff)
    bot._set_amount(dlg, amount)
    bot._require_payment_matches(dlg, tariff, amount, apartment)
    before = shot(win, f"BEFORE-PAY-{apartment}-{tariff}-{amount}")
    print("before-pay", before)
    print("WIN32", bot._win32_apartment(), bot._read_tariff(), bot._read_amount())
    bot._require_payment_matches(dlg, tariff, amount, apartment)
    print("CLICKING PAY NOW", apartment, tariff, amount)
    bot._click_dialog_pay(dlg)
    bot._maximize_invoice()
    receipt = grab_invoice(f"INVOICE-{apartment}")
    print("receipt", receipt)
    return receipt


def finish_phone(ru: str) -> None:
    reopen = subprocess.run(
        [sys.executable, str(ROOT / "phone_fast_ru.py"), ru],
        cwd=str(ROOT),
    )
    if reopen.returncode != 0:
        raise RuntimeError(f"reopen {ru} before SET PIN failed exit {reopen.returncode}")
    r = subprocess.run(
        [sys.executable, str(ROOT / "phone_finish_ru.py"), ru],
        cwd=str(ROOT),
    )
    if r.returncode != 0:
        raise RuntimeError(f"attach or SET PIN failed exit {r.returncode}")


def close_invoice() -> None:
    bot = NovaSysRobot()
    bot.connect()
    bot._close_invoice_if_open()


def main() -> int:
    from bot_switch import require_bot_on
    from watch_open import nav_should_retry

    require_bot_on()
    ru = sys.argv[1]
    unit = sys.argv[2] if len(sys.argv) > 2 else ""
    print(f"PLANB START {ru} {unit}")
    try:
        tariff, amount = items_from_phone(ru)
        print(f"ITEMS {tariff} {amount}")
    except SystemExit as exc:
        if exc.code == 4:
            wake("laptop stopped", f"{ru} {unit} bot switch unread")
            return 4
        raise
    except Exception as exc:
        wake("laptop stopped", f"{ru} {unit} {exc}")
        if nav_should_retry(exc):
            return 5
        return 2

    try:
        stay = threading.Event()
        keeper = threading.Thread(target=_keep_request_awake, args=(stay,), daemon=True)
        keeper.start()
        try:
            apt = nova_query(unit)
            handle_login_locked(20)
            bot = NovaSysRobot()
            bot.connect()
            bot._open_payments()
            verdict, path = nova_search(apt)
            print(f"SEARCH {apt} {verdict} {path}")
            if not icon_ok(verdict, path):
                if verdict == "red_x":
                    wake("not green tick", f"{ru} {apt} {verdict} {path}")
                    return 2
                print("pending — Refresh once beside Pay")
                click_nova_refresh()
                verdict, path = nova_search(apt)
                print(f"SEARCH after refresh {apt} {verdict} {path}")
                if not icon_ok(verdict, path):
                    wake("not green tick", f"{ru} {apt} {verdict} {path}")
                    return 2
            charge_and_pay(apt, tariff, amount)
        finally:
            stay.set()
            keeper.join(timeout=2)
        last_pin = None
        for attempt in range(2):
            try:
                finish_phone(ru)
                last_pin = None
                break
            except Exception as exc:
                last_pin = exc
                print("SET PIN retry", attempt + 1, exc)
        if last_pin is not None:
            raise last_pin
        close_invoice()
        wake("AUTO PAID + SET PIN", f"{ru} {apt} {tariff} {amount}")
        return 0
    except SystemExit as exc:
        if exc.code == 4:
            wake("laptop stopped", f"{ru} {unit} bot switch unread")
            return 4
        raise
    except Exception as exc:
        wake("laptop stopped", f"{ru} {unit} {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
