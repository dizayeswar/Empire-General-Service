"""Auto charge: fill Create payment, Pay only if boxes match, then attach + SET PIN."""
from __future__ import annotations

import json
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
from nova_search_filter import (
    PersonalAccountError,
    assert_unit_only_in_personal_account,
    find_win,
    grab_invoice,
    shot,
)
from robot import NovaSysRobot

ROOT = Path(__file__).resolve().parent
NEED_PIN = ROOT / "logs" / "paid_need_pin.json"
SHOT = ROOT / "logs" / "screenshots"
ADB = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "platform-tools/adb.exe"
)


def load_need_pin() -> dict | None:
    try:
        data = json.loads(NEED_PIN.read_text(encoding="utf-8"))
        if data.get("ru"):
            return data
    except Exception:
        pass
    return None


def save_need_pin(**kwargs) -> None:
    NEED_PIN.parent.mkdir(parents=True, exist_ok=True)
    NEED_PIN.write_text(json.dumps(kwargs, indent=2), encoding="utf-8")


def clear_need_pin() -> None:
    try:
        NEED_PIN.unlink()
    except Exception:
        pass


def stash_ru_invoice(ru: str, receipt: Path) -> Path:
    """Keep this RU's paper so SET PIN can retry without a second Pay."""
    dest = SHOT / f"invoice-RU-{''.join(ch for ch in ru if ch.isdigit())}.jpg"
    im = Image.open(receipt)
    w, h = im.size
    im.crop((w // 2 - 300, 50, w // 2 + 340, h - 40)).convert("RGB").save(dest, quality=90)
    return dest


def wake(reason: str, detail: str) -> None:
    prompt = (
        "AUTO PAY. Bot Off = stop (no Pay, no SET PIN). "
        f"{reason} {detail}"
    )
    print(f"AGENT_LOOP_WAKE_new_rus {{\"prompt\":{prompt!r}}}", flush=True)
    print(f"HARD {reason} {detail}", flush=True)


def norm_unit(unit: str) -> str:
    return (unit or "").strip().upper().replace(" ", "")


def norm_money(raw: str) -> str:
    s = str(raw or "").replace("IQD", "").replace(",", "").strip()
    s = s.split(".")[0].strip()
    return s


def same_unit(a: str, b: str) -> bool:
    return bool(norm_unit(a)) and norm_unit(a) == norm_unit(b)


def same_money(a: str, b: str) -> bool:
    try:
        return int(norm_money(a) or 0) == int(norm_money(b) or 0) and int(norm_money(a) or 0) > 0
    except ValueError:
        return False


def require_same_request(*, ru: str, list_unit: str, list_amount: str, detail_unit: str, items_amount: str) -> None:
    """Open card, Request Detail, and Items must be the same apartment and IQD. Else no Pay."""
    if not list_unit or not detail_unit:
        raise RuntimeError(f"MISMATCH unit {ru} list={list_unit!r} detail={detail_unit!r} — no Pay")
    if not same_unit(list_unit, detail_unit):
        raise RuntimeError(f"MISMATCH unit {ru} list={list_unit} detail={detail_unit} — no Pay")
    if list_amount and not same_money(list_amount, items_amount):
        raise RuntimeError(
            f"MISMATCH amount {ru} list={list_amount} items={items_amount} — no Pay"
        )


def nova_query(unit: str) -> str:
    u = (unit or "").strip().upper()
    m = re.match(r"^ES-4-(\d+)-(\d+)$", u)
    if m:
        return f"ES4-{int(m.group(1))}-{int(m.group(2))}"
    m = re.match(r"^ES-6-(\d+)-(\d+)$", u)
    if m:
        return f"ES-6-{int(m.group(1))}-{int(m.group(2))}"
    return u


def items_from_phone(ru: str) -> tuple[str, str, str]:
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
        from phone_screen import dump_screen, tap_items

        items_ui = dump_screen("items-tab")
        detail_unit = ""
        for t in items_ui.texts:
            if t.startswith("Unit -"):
                detail_unit = t.replace("Unit -", "").strip()
        tap_items(items_ui.nodes)
        time.sleep(1.2)
        texts = dump_texts("items-b")
        if not detail_unit:
            for t in texts:
                if t.startswith("Unit -"):
                    detail_unit = t.replace("Unit -", "").strip()
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
            return tariff, amount, detail_unit
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
            time.sleep(4.0)
            return
    except Exception:
        pass
    try:
        pay = bot._main().child_window(title="Pay", control_type="Button")
        pay.wait("exists", timeout=4)
        rect = pay.rectangle()
        click(coords=(rect.left - 28, (rect.top + rect.bottom) // 2))
        print("Clicked Nova Refresh beside Pay")
        time.sleep(4.0)
        return
    except Exception:
        pass
    send_keys("{F5}")
    print("Nova Refresh F5")
    time.sleep(4.0)


def icon_ok(verdict: str, shot_path: Path) -> bool:
    if verdict == "green":
        return True
    if verdict == "red_x":
        return False
    img = Image.open(shot_path).convert("RGB")
    red = green = grey = 0
    for y in range(270, 400):
        for x in range(8, 80):
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
    assert_unit_only_in_personal_account(win, apartment)
    bot._select_result_row(apartment)
    bot._choose_automatic()
    print("Clicked Pay -> Automatic")
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
    if reopen.returncode in (3, 4):
        raise SystemExit(reopen.returncode)
    if reopen.returncode != 0:
        raise RuntimeError(f"reopen {ru} before SET PIN failed exit {reopen.returncode}")
    r = subprocess.run(
        [sys.executable, str(ROOT / "phone_finish_ru.py"), ru],
        cwd=str(ROOT),
    )
    if r.returncode in (3, 4):
        raise SystemExit(r.returncode)
    if r.returncode != 0:
        raise RuntimeError(f"attach or SET PIN failed exit {r.returncode}")


def finish_paid_pin(
    *,
    ru: str,
    unit: str,
    amount: str,
    tariff: str,
    source: str,
    started_at: str,
) -> int:
    """Pay already done. Attach + SET PIN + dashboard. Never Pay again."""
    from save_dashboard import save_charged, utc_iso

    try:
        finish_phone(ru)
        charged_at = utc_iso()
        if source != "overseas":
            close_invoice()
        try:
            save_charged(
                ru=ru,
                unit=unit,
                amount=amount,
                source=source,
                tariff=tariff,
                started_at=started_at,
                charged_at=charged_at,
            )
        except Exception as exc:
            print("dashboard save failed", exc)
            wake("dashboard save failed", f"{ru} {unit} {tariff} {amount} {exc}")
        else:
            wake("AUTO PAID + SET PIN", f"{ru} {unit} {tariff} {amount}")
        clear_need_pin()
        return 0
    except SystemExit as exc:
        if exc.code == 3:
            return 3
        print("SET PIN leftover retry", ru, exc)
        return 6
    except Exception as exc:
        print("SET PIN leftover retry", ru, exc)
        return 6


def close_invoice() -> None:
    bot = NovaSysRobot()
    bot.connect()
    bot._close_invoice_if_open()


def main() -> int:
    from bot_switch import require_bot_on
    from watch_open import nav_should_retry, unit_on_hold

    pin_only = "--pin-only" in sys.argv
    argv = [a for a in sys.argv[1:] if a != "--pin-only"]
    ru = argv[0]
    unit = argv[1] if len(argv) > 1 else ""
    from save_dashboard import utc_iso

    started_at = argv[2] if len(argv) > 2 else utc_iso()
    list_amount = argv[3] if len(argv) > 3 else ""
    need = load_need_pin()
    leftover = pin_only or bool(need and need.get("ru") == ru)
    require_bot_on(allow_unread=leftover)
    if leftover:
        n = need or {}
        print(f"SET PIN leftover {ru} {unit or n.get('unit') or ''} — no second Pay")
        return finish_paid_pin(
            ru=ru,
            unit=unit or n.get("unit") or "",
            amount=str(n.get("amount") or ""),
            tariff=n.get("tariff") or "T1",
            source=n.get("source") or "nova",
            started_at=n.get("started_at") or started_at,
        )
    if unit_on_hold(unit):
        print(f"HOLD skip {ru} {unit} — no Pay")
        return 2
    try:
        tariff, amount, detail_unit = items_from_phone(ru)
        print(f"ITEMS {tariff} {amount} unit={detail_unit}")
        require_same_request(
            ru=ru,
            list_unit=unit,
            list_amount=list_amount,
            detail_unit=detail_unit,
            items_amount=amount,
        )
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

    paid = False
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
            try:
                verdict, path = nova_search(apt)
            except PersonalAccountError as exc:
                print("PA LOCK", exc)
                from save_dashboard import save_skip

                save_skip(
                    ru=ru,
                    unit=apt,
                    status="cannot_charge",
                    note=f"Nova filter not Personal account {exc}",
                    source="nova",
                    amount=amount,
                    tariff=tariff,
                    started_at=started_at,
                )
                wake("wrong Nova filter", f"{ru} {apt} {exc}")
                return 2
            print(f"SEARCH {apt} {verdict} {path}")
            if not icon_ok(verdict, path):
                if verdict == "red_x":
                    from save_dashboard import save_skip

                    save_skip(
                        ru=ru,
                        unit=apt,
                        status="cannot_charge",
                        note=f"Nova red X {path}",
                        source="nova",
                        amount=amount,
                        tariff=tariff,
                        started_at=started_at,
                    )
                    wake("not green tick", f"{ru} {apt} {verdict} {path}")
                    return 2
                print("pending — Refresh once beside Pay")
                click_nova_refresh()
                verdict, path = nova_search(apt)
                print(f"SEARCH after refresh {apt} {verdict} {path}")
                if not icon_ok(verdict, path):
                    from save_dashboard import save_skip

                    save_skip(
                        ru=ru,
                        unit=apt,
                        status="cannot_charge",
                        note=f"Nova pending after one Refresh {path}",
                        source="nova",
                        amount=amount,
                        tariff=tariff,
                        started_at=started_at,
                    )
                    wake("not green tick", f"{ru} {apt} {verdict} {path}")
                    return 2
            receipt = charge_and_pay(apt, tariff, amount)
            paid = True
            stash_ru_invoice(ru, receipt)
            save_need_pin(
                ru=ru,
                unit=apt,
                amount=amount,
                tariff=tariff,
                source="nova",
                started_at=started_at,
            )
        finally:
            stay.set()
            keeper.join(timeout=2)
        last_pin = None
        for attempt in range(2):
            try:
                finish_phone(ru)
                last_pin = None
                break
            except SystemExit as exc:
                last_pin = exc
                print("SET PIN retry", attempt + 1, exc)
                if exc.code == 3:
                    raise
            except Exception as exc:
                last_pin = exc
                print("SET PIN retry", attempt + 1, exc)
        if last_pin is not None:
            raise last_pin
        from save_dashboard import save_charged, utc_iso

        charged_at = utc_iso()
        close_invoice()
        try:
            save_charged(
                ru=ru,
                unit=apt,
                amount=amount,
                source="nova",
                tariff=tariff,
                started_at=started_at,
                charged_at=charged_at,
            )
        except Exception as exc:
            print("dashboard save failed", exc)
            wake("dashboard save failed", f"{ru} {apt} {tariff} {amount} {exc}")
        else:
            wake("AUTO PAID + SET PIN", f"{ru} {apt} {tariff} {amount}")
        clear_need_pin()
        return 0
    except PersonalAccountError as exc:
        wake("wrong Nova filter", f"{ru} {unit} {exc}")
        return 2
    except SystemExit as exc:
        if exc.code == 3:
            return 3
        if exc.code == 4:
            if paid:
                wake("SET PIN leftover", f"{ru} {unit} bot switch unread after Pay")
                return 6
            wake("laptop stopped", f"{ru} {unit} bot switch unread")
            return 4
        raise
    except Exception as exc:
        wake("laptop stopped", f"{ru} {unit} {exc}")
        if paid:
            return 6
        return 5


if __name__ == "__main__":
    raise SystemExit(main())
