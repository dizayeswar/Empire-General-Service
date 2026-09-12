"""Auto charge: fill Create payment, Pay only if boxes match, then attach + SET PIN."""
from __future__ import annotations

import re
import subprocess
import sys
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
    subprocess.run(
        [sys.executable, str(ROOT / "phone_fast_ru.py"), ru],
        check=True,
        cwd=str(ROOT),
    )
    adb = str(ADB)
    subprocess.run([adb, "shell", "input", "tap", "777", "2118"], timeout=20)
    time.sleep(1.2)
    ui = ROOT / "logs" / "phone-ui"
    ui.mkdir(parents=True, exist_ok=True)
    subprocess.run([adb, "shell", "uiautomator", "dump", "/sdcard/uidump.xml"], timeout=20)
    subprocess.run([adb, "pull", "/sdcard/uidump.xml", str(ui / "items-b.xml")], timeout=20)
    import xml.etree.ElementTree as ET

    texts = [
        n.attrib.get("text") or ""
        for n in ET.parse(ui / "items-b.xml").getroot().iter("node")
        if n.attrib.get("text")
    ]
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
    if tariff not in {"T1", "T2"} or not amount.isdigit():
        raise RuntimeError(f"bad items tariff={tariff} amount={amount} texts={texts[:16]}")
    return tariff, amount


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


def charge_and_pay(apartment: str, tariff: str, amount: str) -> Path:
    from bot_switch import require_bot_on

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
    require_bot_on()
    bot._require_payment_matches(dlg, tariff, amount, apartment)
    print("CLICKING PAY NOW", apartment, tariff, amount)
    bot._click_dialog_pay(dlg)
    bot._maximize_invoice()
    receipt = grab_invoice(f"INVOICE-{apartment}")
    print("receipt", receipt)
    return receipt


def finish_phone(ru: str) -> None:
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

    require_bot_on()
    ru = sys.argv[1]
    unit = sys.argv[2] if len(sys.argv) > 2 else ""
    print(f"PLANB START {ru} {unit}")
    try:
        tariff, amount = items_from_phone(ru)
        print(f"ITEMS {tariff} {amount}")
        apt = nova_query(unit)
        verdict, path = nova_search(apt)
        print(f"SEARCH {apt} {verdict} {path}")
        if not icon_ok(verdict, path):
            wake("not green tick", f"{ru} {apt} {verdict} {path}")
            return 2
        charge_and_pay(apt, tariff, amount)
        finish_phone(ru)
        close_invoice()
        wake("AUTO PAID + SET PIN", f"{ru} {apt} {tariff} {amount}")
        return 0
    except Exception as exc:
        wake("laptop stopped", f"{ru} {unit} {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
