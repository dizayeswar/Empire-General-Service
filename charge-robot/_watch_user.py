"""UNUSED live path. Start charge-robot/watch_loop.ps1 only."""
from __future__ import annotations

import ctypes
import time
from datetime import datetime
from pathlib import Path

from PIL import ImageGrab
from pywinauto import Desktop

ROOT = Path(__file__).resolve().parent / "logs" / "user-teach"
SHOT = ROOT / "shots"
LOG = ROOT / "clicks.txt"
STOP = ROOT / "STOP"
NOVA_TITLE = r"(?i).*NovaSys EnergySale.*"
VK_LBUTTON = 0x01
user32 = ctypes.windll.user32


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


def find_win():
    desktop = Desktop(backend="uia")
    matches = desktop.windows(title_re=NOVA_TITLE)
    visible = [w for w in matches if w.is_visible()]
    if not visible and not matches:
        return None
    return max(visible or matches, key=lambda w: w.rectangle().width() * w.rectangle().height())


def cursor():
    p = POINT()
    user32.GetCursorPos(ctypes.byref(p))
    return p.x, p.y


def left_down():
    return bool(user32.GetAsyncKeyState(VK_LBUTTON) & 0x8000)


def grab(win, name: str) -> Path:
    SHOT.mkdir(parents=True, exist_ok=True)
    path = SHOT / f"{datetime.now().strftime('%H%M%S-%f')[:-3]}-{name}.png"
    try:
        if win is not None:
            r = win.rectangle()
            ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True).save(path)
        else:
            ImageGrab.grab(all_screens=True).save(path)
    except Exception:
        ImageGrab.grab(all_screens=True).save(path)
    return path


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    SHOT.mkdir(parents=True, exist_ok=True)
    if STOP.exists():
        STOP.unlink()
    win = find_win()
    if win is None:
        print("NOVA_NOT_OPEN")
    else:
        r = win.rectangle()
        print(f"WATCHING nova {r}")
        p = grab(win, "start")
        print(f"START {p}")
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"\n=== start {datetime.now().isoformat()} ===\n")
        if win is not None:
            r = win.rectangle()
            f.write(f"win {r.left},{r.top},{r.right},{r.bottom}\n")
        f.flush()
        down = False
        last_idle = time.time()
        n = 0
        while not STOP.exists():
            win = find_win()
            pressed = left_down()
            if pressed and not down:
                n += 1
                x, y = cursor()
                if win is not None:
                    r = win.rectangle()
                    rel = f"rel={x - r.left},{y - r.top} win={r.left},{r.top},{r.right},{r.bottom}"
                else:
                    rel = "nova=missing"
                path = grab(win, f"click{n:02d}")
                line = f"{datetime.now().strftime('%H:%M:%S')} click{n:02d} screen={x},{y} {rel} {path.name}"
                print(line, flush=True)
                f.write(line + "\n")
                f.flush()
                last_idle = time.time()
            down = pressed
            if time.time() - last_idle >= 2.5:
                last_idle = time.time()
                path = grab(win, "idle")
                print(f"{datetime.now().strftime('%H:%M:%S')} idle {path.name}", flush=True)
            time.sleep(0.03)
    print("STOPPED")


if __name__ == "__main__":
    main()
