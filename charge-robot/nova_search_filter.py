"""Click the Personal account grid filter only. Refuse Pay if the unit is in any other column."""
from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

from PIL import Image
from pywinauto import Desktop
from pywinauto.keyboard import send_keys
from pywinauto.mouse import click

SHOT = Path(__file__).resolve().parent / "logs" / "screenshots"
NOVA_TITLE = r"(?i).*NovaSys EnergySale.*"
PA_TITLES = ("Personal account", "Personal Account")
OTHER_TITLES = (
    "Binding",
    "Serial",
    "Serial number",
    "Meter",
    "Name",
    "LALGANG",
    "Address",
    "Records",
)

_LAST_FILTER_Y = 0
_LAST_PA_COL = (0, 0)


class PersonalAccountError(RuntimeError):
    """Unit was typed or still showing in a column that is not Personal account."""


def find_win():
    desktop = Desktop(backend="uia")
    matches = desktop.windows(title_re=NOVA_TITLE)
    if not matches:
        raise RuntimeError("NovaSys EnergySale is not open.")
    visible = [w for w in matches if w.is_visible()]
    return max(visible or matches, key=lambda w: w.rectangle().width() * w.rectangle().height())


def last_filter_y() -> int:
    return _LAST_FILTER_Y


def last_pa_col() -> tuple[int, int]:
    return _LAST_PA_COL


def shot(win, name: str) -> Path:
    SHOT.mkdir(parents=True, exist_ok=True)
    path = SHOT / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{name}.png"
    try:
        win.capture_as_image().save(path)
    except Exception:
        from PIL import ImageGrab

        r = win.rectangle()
        ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom)).save(path)
    return path


def grab_invoice(name: str = "INVOICE") -> Path:
    """Grab the Invoice paper window (usually on the primary monitor), not Nova."""
    from PIL import ImageGrab

    SHOT.mkdir(parents=True, exist_ok=True)
    d32 = Desktop(backend="win32")
    inv = d32.window(title="Invoice")
    if not inv.exists(timeout=0.8) or not inv.is_visible():
        raise RuntimeError("Invoice window is not open.")
    r = inv.rectangle()
    path = SHOT / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{name}.png"
    ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True).save(path)
    return path


def filter_row_cols(img: Image.Image):
    """Light-blue grid filter. HDMI sat near y=200; laptop (no extra screen) near y=330."""
    rgb = img.convert("RGB")
    w, _ = rgb.size
    y = None
    for yy in range(160, 420):
        pix = [rgb.getpixel((x, yy)) for x in range(0, w, 8)]
        r = sum(p[0] for p in pix) / len(pix)
        b = sum(p[2] for p in pix) / len(pix)
        if b > r + 8:
            y = yy
            break
    if y is None:
        raise RuntimeError("Could not find the light-blue filter row.")
    runs = []
    cur = None
    start = 0
    for x in range(w):
        r, g, b = rgb.getpixel((x, y + 4 if y + 4 < rgb.size[1] else y))
        if r > 245 and g > 245 and b > 245:
            kind = "white"
        elif b > r + 8:
            kind = "blue"
        else:
            kind = "other"
        if kind != cur:
            if cur is not None:
                runs.append((cur, start, x - 1))
            cur = kind
            start = x
    runs.append((cur, start, w - 1))
    cols = [(a, b) for kind, a, b in runs if kind == "blue" and (b - a) > 20]
    return y + 8, cols


# Measured on 1940-wide EnergySale: "Personal account" header sits near x=1016.
# Blue filter runs merge Name+PA+neighbours, so we click the header x, not a col center.
_PA_X_AT_1940 = 1016
_PA_HALF = 70


def personal_account_x(img: Image.Image, filter_y: int) -> int:
    """X of the painted Personal account header, window-relative."""
    rgb = img.convert("RGB")
    w, _ = rgb.size
    baked = int(_PA_X_AT_1940 * w / 1940)
    score = [0] * w
    y0 = max(0, filter_y - 63)
    y1 = max(y0 + 1, filter_y - 10)
    for yy in range(y0, y1):
        for x in range(20, w - 20):
            r, g, b = rgb.getpixel((x, yy))
            avg = (r + g + b) / 3
            if avg < 180 and max(r, g, b) - min(r, g, b) < 55:
                score[x] += 1
    best = None
    best_n = 0
    cur = None
    for x, s in enumerate(score):
        if s >= 1 and cur is None:
            cur = x
        elif s < 1 and cur is not None:
            n = sum(score[cur:x])
            mid = (cur + x) // 2
            if x - cur > 8 and 880 <= mid <= 1150 and n > best_n:
                best = mid
                best_n = n
            cur = None
    return best if best is not None else baked


def personal_account_col(cols):
    """Kept for nova_check_unit. Click path uses personal_account_x, not this."""
    if len(cols) < 4:
        raise PersonalAccountError(f"Not enough filter columns: {cols}")
    x = _PA_X_AT_1940
    for a, b in cols:
        if a - 8 <= x <= b + 8:
            return (a, b)
    return (x - _PA_HALF, x + _PA_HALF)


def pa_band(pa_x: int) -> tuple[int, int]:
    return (pa_x - _PA_HALF, pa_x + _PA_HALF)


def personal_account_click(win):
    """Click the filter cell under the Personal account header."""
    global _LAST_FILTER_Y, _LAST_PA_COL
    img = win.capture_as_image()
    y, cols = filter_row_cols(img)
    pa_x = personal_account_x(img, y)
    pa = pa_band(pa_x)
    wr = win.rectangle()
    sx, sy = wr.left + pa_x, wr.top + y
    _LAST_FILTER_Y = y
    _LAST_PA_COL = pa
    return sx, sy, pa, y, cols


def filter_text_xs(img: Image.Image, fy: int) -> list[int]:
    """Mids of typed text sitting in the blue filter row."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    y0 = max(0, fy - 8)
    y1 = min(h, fy + 16)
    hits: list[int] = []
    for yy in range(y0, y1):
        for x in range(20, w - 20):
            r, g, b = rgb.getpixel((x, yy))
            if b > r + 5 and (r + g + b) / 3 < 200:
                hits.append(x)
            elif (r + g + b) / 3 < 160:
                hits.append(x)
    if not hits:
        return []
    hits.sort()
    mids: list[int] = []
    start = hits[0]
    prev = hits[0]
    for x in hits[1:] + [None]:
        if x is None or x > prev + 4:
            if prev - start >= 6 and start > 50:
                mids.append((start + prev) // 2)
            if x is not None:
                start = x
        if x is not None:
            prev = x
    return mids


def filter_fill_map(img: Image.Image, cols, fy: int, pa_rel: tuple[int, int]):
    pa0, pa1 = pa_rel
    mids = filter_text_xs(img, fy)
    pa_filled = any(pa0 <= m <= pa1 for m in mids)
    others = [(m - 20, m + 20) for m in mids if m < pa0 - 8 or m > pa1 + 8]
    return pa_filled, others


def clear_filter_cell(win, col: tuple[int, int], fy: int) -> None:
    wr = win.rectangle()
    click(coords=(wr.left + (col[0] + col[1]) // 2, wr.top + fy))
    time.sleep(0.15)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.08)
    send_keys("{ENTER}")
    time.sleep(0.25)


def clear_other_filters(win, pa_rel: tuple[int, int], fy: int, cols) -> None:
    img = win.capture_as_image()
    _pa, others = filter_fill_map(img, cols, fy, pa_rel)
    for col in others:
        print(f"clear stray filter col={col}")
        clear_filter_cell(win, col, fy)


def _pa_rel(win, cols, fy: int) -> tuple[int, int]:
    img = win.capture_as_image()
    return pa_band(personal_account_x(img, fy))


def unit_only_in_personal_account(win, apartment: str) -> bool:
    """True only if the filter row has text under Personal account and nowhere else."""
    img = win.capture_as_image()
    y, cols = filter_row_cols(img)
    pa_rel = pa_band(personal_account_x(img, y))
    pa_filled, others = filter_fill_map(img, cols, y, pa_rel)
    print(
        f"PA check unit={apartment} pa_filled={pa_filled} stray={others} "
        f"pa={pa_rel} y={y} cols={cols}"
    )
    return pa_filled and not others


def assert_unit_only_in_personal_account(win, apartment: str) -> None:
    if not unit_only_in_personal_account(win, apartment):
        raise PersonalAccountError(
            f"{apartment} is not under Personal account only — no Pay"
        )


def _type_in_personal_account(win, apartment: str):
    sx, sy, pa, y, cols = personal_account_click(win)
    pa_rel = pa
    print(f"click Personal account filter at ({sx},{sy}) col={pa} y={y}")
    print("cols", cols)
    clear_other_filters(win, pa_rel, y, cols)
    sx, sy, pa, y, cols = personal_account_click(win)
    click(coords=(sx, sy))
    time.sleep(0.25)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.1)
    send_keys(apartment, with_spaces=True)
    send_keys("{ENTER}")
    time.sleep(1.2)
    return pa, y, cols, pa


def search(apartment: str) -> Path:
    """Type the unit under Personal account only. Retry once if another column filled."""
    win = find_win()
    win.set_focus()
    time.sleep(0.25)
    _type_in_personal_account(win, apartment)
    path = shot(win, f"search-{apartment}")
    print(path)
    if unit_only_in_personal_account(win, apartment):
        return path
    print("PA retry — unit was in another filter, clear and type again")
    img = win.capture_as_image()
    y, cols = filter_row_cols(img)
    pa_rel = _pa_rel(win, cols, y)
    clear_other_filters(win, pa_rel, y, cols)
    _type_in_personal_account(win, apartment)
    path = shot(win, f"search-{apartment}-retry")
    print(path)
    if unit_only_in_personal_account(win, apartment):
        return path
    raise PersonalAccountError(
        f"{apartment} still in a column that is not Personal account — no Pay {path}"
    )


if __name__ == "__main__":
    apt = sys.argv[1] if len(sys.argv) > 1 else "ES-1-2-08"
    search(apt)
