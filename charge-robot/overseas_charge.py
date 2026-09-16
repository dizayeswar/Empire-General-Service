"""STS Vending charge for one overseas RU. Never type a password."""
from __future__ import annotations

import re
import sys
import threading
import time
from pathlib import Path

from PIL import Image, ImageGrab
from pywinauto import Desktop
from pywinauto.keyboard import send_keys
from pywinauto.mouse import click, double_click

from bot_switch import require_bot_on
from charge_easy import _keep_request_awake, finish_phone, items_from_phone, wake

ROOT = Path(__file__).resolve().parent
SHOT = ROOT / "logs" / "screenshots"
PAUSE = ROOT / "logs" / "overseas_keep.pause"


def ru_invoice_name(ru: str) -> str:
    digits = "".join(ch for ch in ru if ch.isdigit())
    return f"invoice-RU-{digits}.jpg"


def pause_keep() -> None:
    PAUSE.parent.mkdir(parents=True, exist_ok=True)
    PAUSE.write_text("sts", encoding="utf-8")


def unpause_keep() -> None:
    try:
        PAUSE.unlink()
    except FileNotFoundError:
        pass


def edge():
    d = Desktop(backend="uia")
    for w in d.windows():
        t = w.window_text() or ""
        if "Overseas" in t or "rechargePrint" in t or "empire.pswla" in t:
            return w
        if "Edge" in t:
            return w
    raise RuntimeError("Overseas Edge is not open.")


def named(win):
    out = []
    for c in win.descendants():
        name = (c.window_text() or "").strip()
        if name:
            out.append((c.element_info.control_type, name, c, c.rectangle()))
    return out


def click_rect(r) -> None:
    click(coords=((r.left + r.right) // 2, (r.top + r.bottom) // 2))


def find(items, control, name, pred=None):
    for ctrl, text, el, r in items:
        if ctrl == control and text == name and (pred is None or pred(r)):
            return el, r
    return None, None


def has_sts(items) -> bool:
    return any(ctrl == "TabItem" and text.startswith("STS Vending") for ctrl, text, _el, _r in items)


def close_sts_tab(win) -> bool:
    items = named(win)
    for ctrl, text, el, r in items:
        if ctrl != "TabItem" or not text.startswith("STS Vending"):
            continue
        for dx in (-14, -8, -18, -6):
            click(coords=(r.right + dx, (r.top + r.bottom) // 2))
            time.sleep(0.45)
            again = named(win)
            if not has_sts(again):
                print(f"STS tab closed dx={dx}")
                return True
        break
    return not has_sts(named(win))


def click_home(win) -> None:
    items = named(win)
    _, r = find(items, "Hyperlink", "Home")
    if r:
        click_rect(r)
        time.sleep(1.0)


def sign_in_if_needed(win):
    items = named(win)
    if find(items, "Button", "Sign In")[0]:
        time.sleep(1.2)
        items = named(win)
        _, r = find(items, "Button", "Sign In")
        if r:
            click_rect(r)
            print("overseas Sign In clicked (saved password, not typed)")
            time.sleep(4.0)
            win = edge()
            win.set_focus()
    return win


def open_sts(win):
    click_home(win)
    items = named(win)
    _, r = find(items, "Text", "STS Vending", lambda rr: rr.left > 250)
    if r is None:
        _, r = find(items, "Hyperlink", "STS Vending")
    if r is None:
        raise RuntimeError("STS Vending not found on Home")
    click_rect(r)
    time.sleep(2.0)
    return named(edge())


def selector_rows(items, unit: str) -> list:
    want = (unit or "").strip().replace(" ", "").upper()
    skip = {
        "CUSTOMER NAME",
        "CUSTOMER",
        "ISKRAEMECO",
        "SCHEME TYPE",
        "TYPE",
        "METER",
        "NAME",
        "STATUS",
    }
    by_y: dict[int, list] = {}
    for ctrl, text, el, r in items:
        if ctrl != "DataItem":
            continue
        t = (text or "").strip()
        if not t or t.upper() in skip:
            continue
        key = t.replace(" ", "").upper()
        if not re.match(r"^(WW|RV|RA|WD)-", key):
            continue
        by_y.setdefault(r.top // 10, []).append((t, r))
    rows = []
    for _y, cells in sorted(by_y.items()):
        blob = " ".join(t for t, _r in cells).replace(" ", "").upper()
        match_r = cells[0][1]
        label = cells[0][0]
        for t, rr in cells:
            key = t.replace(" ", "").upper()
            if key == want or want in key or key in want:
                match_r = rr
                label = t
                break
        rows.append((label, match_r, want in blob or want == label.replace(" ", "").upper()))
    return rows


def crop_invoice_paper(img: Image.Image) -> Image.Image:
    """Keep the white Invoice slip. Drop Edge chrome, Acrobat bar, and grey PDF background."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def is_paper(r: int, g: int, b: int) -> bool:
        if min(r, g, b) > 210:
            return True
        return g > 90 and g > r + 20 and g > b + 20

    col_frac = []
    for x in range(w):
        hits = 0
        n = 0
        for y in range(0, h, 4):
            n += 1
            if is_paper(*px[x, y]):
                hits += 1
        col_frac.append(hits / n)

    best_len, x0, x1 = 0, 0, 0
    i = 0
    while i < w:
        if col_frac[i] > 0.35:
            j = i
            while j < w and col_frac[j] > 0.35:
                j += 1
            if j - i > best_len:
                best_len, x0, x1 = j - i, i, j
            i = j
        else:
            i += 1
    if best_len < 80:
        raise RuntimeError("overseas invoice paper not found")

    ys = []
    for y in range(h):
        hits = 0
        n = 0
        for x in range(x0, x1, 3):
            n += 1
            if is_paper(*px[x, y]):
                hits += 1
        if n and hits / n > 0.4:
            ys.append(y)
    if len(ys) < 40:
        raise RuntimeError("overseas invoice paper not found")

    pad = 4
    box = (
        max(0, x0 - pad),
        max(0, ys[0] - pad),
        min(w, x1 + pad),
        min(h, ys[-1] + 1 + pad),
    )
    paper = rgb.crop(box)
    print("overseas-invoice-crop", box, paper.size)
    return paper


def grab_pdf_invoice(ru: str) -> Path:
    SHOT.mkdir(parents=True, exist_ok=True)
    dest = SHOT / ru_invoice_name(ru)
    win = edge()
    win.set_focus()
    items = named(win)
    found = False
    for ctrl, text, el, r in items:
        if ctrl == "TabItem" and "rechargePrint" in text:
            click_rect(r)
            time.sleep(0.9)
            found = True
            break
    if not found:
        raise RuntimeError("overseas invoice PDF tab not open")
    win = edge()
    r = win.rectangle()
    img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
    crop_invoice_paper(img).save(dest, quality=92)
    print("overseas-invoice", dest)
    close_pdf_tab(win)
    return dest


def close_pdf_tab(win=None) -> bool:
    """Close the rechargePrint Edge tab. Tab X click misses; Ctrl+W after focusing the tab works."""
    win = win or edge()
    win.set_focus()
    items = named(win)
    for ctrl, text, el, r in items:
        if ctrl == "TabItem" and "rechargePrint" in text:
            click_rect(r)
            time.sleep(0.25)
            send_keys("^w")
            time.sleep(0.6)
            print("closed overseas invoice PDF tab")
            return True
    return False


def type_amount(items, amount: str) -> None:
    box = None
    for ctrl, text, el, r in items:
        if ctrl != "Edit":
            continue
        if text in ("0.00", "0", "0.0"):
            box = r
            break
        if 260 < r.top < 360 and 700 < r.left < 1200:
            box = r
    if box is None:
        raise RuntimeError("Amount box not found")
    click_rect(box)
    time.sleep(0.12)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.08)
    send_keys(str(amount))
    time.sleep(0.2)


def sts_search_and_recharge(unit: str, amount: str, restarted: bool = False) -> str:
    """Return 'charged', 'no_row', or 'ambiguous'."""
    require_bot_on()
    win = edge()
    win.set_focus()
    win = sign_in_if_needed(win)
    close_sts_tab(win)
    items = open_sts(win)

    _, r = find(items, "Hyperlink", "Search", lambda rr: rr.left < 1200)
    if r is None:
        if not restarted:
            print("STS jumped before Customer Name search — start again")
            return sts_search_and_recharge(unit, amount, restarted=True)
        raise RuntimeError("Customer Name search icon not found")
    click_rect(r)
    time.sleep(1.5)
    win = edge()
    win.set_focus()
    items = named(win)

    box = None
    for ctrl, text, el, r in items:
        if ctrl == "Edit" and r.top > 340 and r.top < 420 and r.left > 1000:
            box = r
            break
    if box is None:
        if not restarted:
            print("STS jumped before Unit ID — start again")
            return sts_search_and_recharge(unit, amount, restarted=True)
        raise RuntimeError("Customer Selector box not found")

    typed = (unit or "").strip()
    click_rect(box)
    time.sleep(0.15)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.1)
    send_keys(typed, with_spaces=True)
    time.sleep(0.2)
    items = named(win)
    _, r = find(items, "Hyperlink", "Search", lambda rr: rr.left > 1200)
    if r is None:
        raise RuntimeError("Customer Selector search icon (next to Unit ID) not found")
    click_rect(r)
    time.sleep(2.2)
    items = named(win)
    rows = selector_rows(items, typed)
    print(f"selector rows={len(rows)} {[t for t, _r, _m in rows][:8]}")
    if len(rows) == 0:
        send_keys("{ESC}")
        time.sleep(0.4)
        close_sts_tab(edge())
        click_home(edge())
        return "no_row"
    if len(rows) > 1:
        send_keys("{ESC}")
        time.sleep(0.4)
        close_sts_tab(edge())
        click_home(edge())
        return "ambiguous"

    _t, rr, _m = rows[0]
    double_click(coords=((rr.left + rr.right) // 2, (rr.top + rr.bottom) // 2))
    time.sleep(1.6)
    items = named(edge())
    type_amount(items, amount)
    require_bot_on(fresh=True)
    _, r = find(items, "Hyperlink", "Recharge")
    if r is None:
        raise RuntimeError("Recharge not found")
    click_rect(r)
    print("CLICKING RECHARGE", typed, amount)
    time.sleep(1.2)
    items = named(edge())
    _, r = find(items, "Hyperlink", "Ok", lambda rr: rr.top > 600)
    if r is None:
        _, r = find(items, "Hyperlink", "Ok")
    if r is None:
        raise RuntimeError("pay confirm Ok not found")
    click_rect(r)
    time.sleep(3.5)
    return "charged"


def finish_overseas(ru: str) -> None:
    close_pdf_tab()
    win = edge()
    win.set_focus()
    items = named(win)
    for ctrl, text, el, r in items:
        if ctrl == "TabItem" and "Overseas Integration" in text:
            click_rect(r)
            time.sleep(1.4)
            items = named(win)
            break
    _, r = find(items, "Hyperlink", "Ok", lambda rr: rr.top > 650)
    if r:
        click_rect(r)
        time.sleep(1.0)
        print("Recharge successfully Ok")
    close_sts_tab(edge())
    click_home(edge())


def main() -> int:
    require_bot_on()
    ru = sys.argv[1]
    unit = sys.argv[2] if len(sys.argv) > 2 else ""
    from save_dashboard import utc_iso
    from watch_open import nav_should_retry

    started_at = sys.argv[3] if len(sys.argv) > 3 else utc_iso()
    print(f"PLANB START OVERSEAS {ru} {unit}")
    pause_keep()
    stay = threading.Event()
    keeper = threading.Thread(target=_keep_request_awake, args=(stay,), daemon=True)
    keeper.start()
    charged = False
    try:
        tariff, amount = items_from_phone(ru)
        print(f"ITEMS {tariff} {amount} (overseas ignores T1/T2)")
        result = sts_search_and_recharge(unit, amount)
        if result != "charged":
            from save_dashboard import save_skip

            try:
                save_skip(
                    ru=ru,
                    unit=unit,
                    status=result,
                    note=f"Customer Selector {result}. Not charged.",
                    source="overseas",
                    amount=amount,
                    tariff=tariff,
                    started_at=started_at,
                )
            except Exception as exc:
                print("dashboard skip save failed", exc)
            wake("overseas skip", f"{ru} {unit} {result}")
            return 2
        charged = True
        grab_pdf_invoice(ru)
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
        from save_dashboard import save_charged, utc_iso

        charged_at = utc_iso()
        finish_overseas(ru)
        try:
            save_charged(
                ru=ru,
                unit=unit,
                amount=amount,
                source="overseas",
                tariff=tariff,
                started_at=started_at,
                charged_at=charged_at,
            )
        except Exception as exc:
            print("dashboard save failed", exc)
            wake("dashboard save failed", f"{ru} {unit} overseas {amount} {exc}")
        else:
            wake("AUTO PAID + SET PIN", f"{ru} {unit} overseas {amount}")
        return 0
    except SystemExit as exc:
        if exc.code == 4:
            wake("laptop stopped", f"{ru} {unit} overseas bot switch unread")
            try:
                close_pdf_tab()
                close_sts_tab(edge())
                click_home(edge())
            except Exception:
                pass
            return 4
        raise
    except Exception as exc:
        wake("laptop stopped", f"{ru} {unit} overseas {exc}")
        try:
            close_pdf_tab()
            close_sts_tab(edge())
            click_home(edge())
        except Exception:
            pass
        if not charged and nav_should_retry(exc):
            return 5
        return 2
    finally:
        stay.set()
        unpause_keep()


if __name__ == "__main__":
    raise SystemExit(main())
