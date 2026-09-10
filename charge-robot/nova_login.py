"""Nova login lock. Never type a password."""
from __future__ import annotations

import subprocess
import time

from pywinauto import Desktop
from pywinauto.mouse import click

from robot import _center

NOVA_EXE = r"C:\Program Files (x86)\NIK\NovaSyS EnergySale\Novasys.exe"
EMPTY_LOGIN = ("Login to the NovaSyS", "Login to the NovaSys")


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
            if w.is_visible() and _click_named(w, ("Yes", "&Yes")):
                print("Attention obsolete -> Yes")
                return True
        except Exception:
            continue
    return False


def close_nova_and_reopen() -> None:
    print("Closing Nova, then opening it again")
    subprocess.run(
        ["taskkill", "/IM", "Novasys.exe", "/F"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    time.sleep(2.5)
    subprocess.Popen([NOVA_EXE])
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
