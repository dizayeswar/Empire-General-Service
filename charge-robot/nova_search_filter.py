"""Click Personal account grid filter (not Records) and search a unit."""
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


def find_win():
    desktop = Desktop(backend="uia")
    matches = desktop.windows(title_re=NOVA_TITLE)
    if not matches:
        raise RuntimeError("NovaSys EnergySale is not open.")
    visible = [w for w in matches if w.is_visible()]
    return max(visible or matches, key=lambda w: w.rectangle().width() * w.rectangle().height())


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
    rgb = img.convert("RGB")
    w, _ = rgb.size
    y = None
    for yy in range(160, 300):
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


def personal_account_click(win):
    img = win.capture_as_image()
    y, cols = filter_row_cols(img)
    if len(cols) < 6:
        raise RuntimeError(f"Not enough filter columns: {cols}")
    wide_i = max(range(len(cols)), key=lambda i: cols[i][1] - cols[i][0])
    pa = cols[wide_i + 4] if wide_i + 4 < len(cols) else cols[5]
    x = (pa[0] + pa[1]) // 2
    r = win.rectangle()
    return r.left + x, r.top + y, pa, y, cols


def search(apartment: str) -> Path:
    win = find_win()
    win.set_focus()
    time.sleep(0.25)
    sx, sy, pa, y, cols = personal_account_click(win)
    print(f"click Personal account filter at ({sx},{sy}) col={pa} y={y}")
    print("cols", cols)
    click(coords=(sx, sy))
    time.sleep(0.25)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.1)
    send_keys(apartment, with_spaces=True)
    send_keys("{ENTER}")
    time.sleep(1.2)
    path = shot(win, f"search-{apartment}")
    print(path)
    return path


if __name__ == "__main__":
    apt = sys.argv[1] if len(sys.argv) > 1 else "ES-1-2-08"
    search(apt)
