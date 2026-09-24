"""UNUSED live path. Start charge-robot/watch_loop.ps1 only."""
from datetime import datetime
from pathlib import Path

from PIL import ImageGrab
from pywinauto import Desktop

SHOT = Path(__file__).resolve().parent / "logs" / "screenshots"
SHOT.mkdir(parents=True, exist_ok=True)

desktop = Desktop(backend="uia")
print("=== UIA windows ===")
for w in desktop.windows():
    try:
        if not w.is_visible():
            continue
        t = w.window_text() or ""
        r = w.rectangle()
        if r.width() < 80:
            continue
        print(repr(t)[:90], r)
    except Exception:
        pass

d32 = Desktop(backend="win32")
print("=== win32 titled ===")
for title in (
    "Login to the NovaSyS",
    "Login to the NovaSys",
    "Logging in to NovaSys",
    "Logging on to NovaSys",
    "Attention!",
    "Create payment",
    "Invoice",
):
    try:
        w = d32.window(title=title)
        if w.exists(timeout=0.2):
            print("FOUND", title, "visible", w.is_visible(), w.rectangle())
    except Exception as exc:
        print("err", title, exc)

matches = desktop.windows(title_re=r"(?i).*NovaSys.*")
if matches:
    win = max(matches, key=lambda w: w.rectangle().width() * w.rectangle().height())
    p = SHOT / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-nova-now.png"
    try:
        win.capture_as_image().save(p)
    except Exception:
        r = win.rectangle()
        ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom)).save(p)
    print("shot", p)
