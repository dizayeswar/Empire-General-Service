"""Nova login lock. Never type a password."""
from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

from pywinauto import Desktop
from pywinauto.mouse import click

from robot import _center

NOVA_EXE = r"C:\Program Files (x86)\NIK\NovaSyS EnergySale\Novasys.exe"
NOVA_TITLE = r"(?i).*NovaSys EnergySale.*"
EMPTY_LOGIN = ("Login to the NovaSyS", "Login to the NovaSys")
DESKTOP_HINTS = ("novasys energysale", "energysale", "novasys", "nova")


def _click_named(win, titles: tuple[str, ...]) -> bool:
    for t in titles:
        try:
            btn = win.child_window(title=t)
            if btn.exists(timeout=0.2):
                r = btn.rectangle()
                click(coords=_center(r))
                return True
        except Exception:
            continue
    return False


def _empty_login():
    d32 = Desktop(backend="win32")
    for title in EMPTY_LOGIN:
        try:
            w = d32.window(title=title)
            if w.exists(timeout=0.2) and w.is_visible():
                return w
        except Exception:
            continue
    return None


def _click_attention_yes() -> bool:
    uia = Desktop(backend="uia")
    for w in uia.windows(title="Attention!"):
        try:
            if not w.is_visible():
                continue
            if _click_named(w, ("Yes", "&Yes")):
                print("Attention obsolete -> Yes")
                return True
            for c in w.descendants():
                t = (c.window_text() or "").replace("&", "").strip().lower()
                if t == "yes":
                    r = c.rectangle()
                    click(coords=_center(r))
                    print("Attention obsolete -> Yes")
                    return True
        except Exception:
            continue
    return False


def _visible_energy_sale():
    try:
        matches = Desktop(backend="uia").windows(title_re=NOVA_TITLE)
        visible = [w for w in matches if w.is_visible()]
        if visible:
            return max(visible, key=lambda w: w.rectangle().width() * w.rectangle().height())
    except Exception:
        return None
    return None


def _desktop_dirs() -> list[Path]:
    home = Path.home()
    public = Path(os.environ.get("PUBLIC", r"C:\Users\Public"))
    seen: list[Path] = []
    for d in (home / "Desktop", home / "OneDrive" / "Desktop", public / "Desktop"):
        if d.is_dir() and d not in seen:
            seen.append(d)
    return seen


def _name_score(name: str) -> int:
    low = name.lower()
    for i, hint in enumerate(DESKTOP_HINTS):
        if hint in low:
            return len(DESKTOP_HINTS) - i
    return 0


def find_desktop_nova() -> Path | None:
    """Desktop shortcut first, then Novasys.exe. Never a random file named nova."""
    hits: list[tuple[int, Path]] = []
    for folder in _desktop_dirs():
        try:
            kids = list(folder.iterdir())
        except OSError:
            continue
        for p in kids:
            if p.suffix.lower() not in {".lnk", ".exe"}:
                continue
            score = _name_score(p.name)
            if score:
                hits.append((score, p))
    if hits:
        hits.sort(key=lambda x: (-x[0], x[1].suffix.lower() != ".lnk", x[1].name.lower()))
        return hits[0][1]
    exe = Path(NOVA_EXE)
    return exe if exe.is_file() else None


def launch_nova() -> Path:
    target = find_desktop_nova()
    if target is None:
        raise RuntimeError("NovaSyS EnergySale shortcut not on desktop and Novasys.exe missing.")
    print("Opening", target)
    os.startfile(str(target))
    return target


def ensure_nova_open(seconds: int = 40) -> None:
    """If EnergySale is closed, search the desktop and open it. Never type a password."""
    if _visible_energy_sale() is not None:
        handle_login_locked(min(8, seconds))
        if _visible_energy_sale() is not None:
            print("ALREADY OPEN")
            return
    print("EnergySale not open — searching desktop")
    launch_nova()
    deadline = time.time() + seconds
    while time.time() < deadline:
        handle_login_locked(3)
        if _visible_energy_sale() is not None:
            print("NOVA_OK opened from desktop")
            return
        time.sleep(0.4)
    raise RuntimeError(
        "Opened Nova from desktop but EnergySale window did not appear. Leave it logged in."
    )


def close_nova_and_reopen() -> None:
    print("Closing Nova, then opening it again")
    subprocess.run(
        ["taskkill", "/IM", "Novasys.exe", "/F"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    time.sleep(2.5)
    launch_nova()
    deadline = time.time() + 90
    yes = False
    while time.time() < deadline:
        if _click_attention_yes():
            yes = True
            time.sleep(1.0)
            break
        time.sleep(0.4)
    if not yes:
        raise RuntimeError("Nova reopened but Attention Yes did not appear.")
    time.sleep(2.0)
    print("Nova reopened after Yes")


def handle_login_locked(seconds: int = 12) -> None:
    """Empty swar login -> Cancel -> close Nova -> open Nova -> Yes on obsolete DB.

    Never type a password. Never OK the empty login. Never OK the 'Logging in' box.
    """
    deadline = time.time() + seconds
    while time.time() < deadline:
        if _click_attention_yes():
            time.sleep(0.5)
            continue
        empty = _empty_login()
        if empty is not None:
            if _click_named(empty, ("Cancel", "&Cancel")):
                print("Login swar empty password -> Cancel")
                time.sleep(0.4)
            close_nova_and_reopen()
            continue
        time.sleep(0.2)
