"""UNUSED live path. Start charge-robot/watch_loop.ps1 only."""
import time
from datetime import datetime
from pathlib import Path

from pywinauto import Desktop
from pywinauto.mouse import click

SHOT = Path(__file__).resolve().parent / "logs" / "screenshots"
NOVA_TITLE = r"(?i).*NovaSys EnergySale.*"


def find_win():
    desktop = Desktop(backend="uia")
    matches = desktop.windows(title_re=NOVA_TITLE)
    visible = [w for w in matches if w.is_visible()]
    return max(visible or matches, key=lambda w: w.rectangle().width() * w.rectangle().height())


win = find_win()
win.set_focus()
time.sleep(0.3)
r = win.rectangle()
# Known from ES-1-2-08 layout: Personal account mid-x 818, first data row ~294
sx = r.left + 818
sy = r.top + 294
print("click", sx, sy, "win", r)
click(coords=(sx, sy))
time.sleep(0.7)
path = SHOT / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-row-clicked.png"
win.capture_as_image().save(path)
print(path)
