"""Search Personal account filter and classify first-column icon. No Pay."""
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


def first_col_verdict(img: Image.Image) -> str:
    rgb = img.convert("RGB")
    # first data row is just below the blue filter (y ~278)
    red = 0
    green = 0
    grey = 0
    for y in range(276, 312):
        for x in range(8, 42):
            r, g, b = rgb.getpixel((x, y))
            # red X only — do not count orange/red row fill as a red icon
            if r > 200 and g < 90 and b < 90:
                red += 1
            elif g > 170 and g > r + 25:
                green += 1
            elif abs(r - g) < 18 and abs(g - b) < 18 and 90 < r < 190:
                grey += 1
    print(f"icon pixels red={red} green={green} grey={grey}")
    if green >= 20 and green > red and green > grey:
        return "green"
    if red >= 12 and red > green:
        return "red_x"
    if grey >= 20 and grey > green:
        return "pending"
    return "other"


def search(apartment: str) -> tuple[str, Path]:
    win = find_win()
    win.set_focus()
    time.sleep(0.2)
    img = win.capture_as_image()
    y, cols = filter_row_cols(img)
    wide_i = max(range(len(cols)), key=lambda i: cols[i][1] - cols[i][0])
    pa = cols[wide_i + 4] if wide_i + 4 < len(cols) else cols[5]
    r = win.rectangle()
    sx = r.left + (pa[0] + pa[1]) // 2
    sy = r.top + y
    click(coords=(sx, sy))
    time.sleep(0.2)
    send_keys("^a{BACKSPACE}")
    time.sleep(0.1)
    send_keys(apartment, with_spaces=True)
    send_keys("{ENTER}")
    time.sleep(1.3)
    path = shot(win, f"search-{apartment}")
    verdict = first_col_verdict(Image.open(path))
    print(f"apartment={apartment} verdict={verdict} shot={path}")
    return verdict, path


if __name__ == "__main__":
    search(sys.argv[1] if len(sys.argv) > 1 else "ES-3-17-01")
