"""Open one RU on the phone: search, confirm one card, open, print fields."""
from __future__ import annotations

import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ADB = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "platform-tools/adb.exe"
)
DIR = Path(__file__).resolve().parent / "logs" / "phone-ui"
PKG = "com.abacuscambridge.empireworldErbil"


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=20)
    return (r.stdout or "") + (r.stderr or "")


def dump_texts() -> list[str]:
    DIR.mkdir(parents=True, exist_ok=True)
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    adb("pull", "/sdcard/uidump.xml", str(DIR / "now.xml"))
    root = ET.parse(DIR / "now.xml").getroot()
    texts = []
    for n in root.iter("node"):
        t = n.attrib.get("text") or ""
        if t:
            texts.append(t)
    return texts


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def wake() -> None:
    adb("shell", "input", "keyevent", "224")
    adb("shell", "input", "swipe", "540", "1600", "540", "200", "250")
    time.sleep(0.3)
    focus = adb("shell", "dumpsys", "window")
    if "NotificationShade" in focus:
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.2)
    if PKG not in focus:
        adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
        time.sleep(1.0)


def ensure_requests() -> None:
    texts = dump_texts()
    joined = " | ".join(texts)
    if "Getting Requests" in joined:
        time.sleep(2.5)
        texts = dump_texts()
        joined = " | ".join(texts)
    if "Open" in texts and "Closed" in texts and any(t.startswith("Buy -") for t in texts):
        return
    if "Buy -" in joined or "Getting Requests" in joined:
        return
    # Home -> bottom Requests tab
    tap(405, 2144)
    time.sleep(2.2)
    for _ in range(4):
        texts = dump_texts()
        if "Getting Requests" in " | ".join(texts):
            time.sleep(1.5)
            continue
        if any(t.startswith("Buy -") for t in texts) or "Open" in texts:
            return
        tap(234, 920)
        time.sleep(2.0)


def search_ru(ru: str) -> list[str]:
    tap(460, 369)
    time.sleep(0.25)
    adb("shell", "input", "keyevent", "123")
    adb("shell", "input", "keyevent", "--longpress", "67")
    adb("shell", "input", "text", ru)
    time.sleep(1.6)
    return dump_texts()


def open_card() -> list[str]:
    tap(540, 980)
    time.sleep(1.2)
    return dump_texts()


def main() -> None:
    from bot_switch import require_bot_on

    require_bot_on()
    ru = sys.argv[1] if len(sys.argv) > 1 else ""
    if not ru.startswith("RU-"):
        raise SystemExit("need RU-#####")
    wake()
    ensure_requests()
    texts = search_ru(ru)
    buys = [t for t in texts if t.startswith("Buy -")]
    print("SEARCH")
    for t in texts:
        print(t)
    if len(buys) != 1 or buys[0] != f"Buy - {ru}":
        raise SystemExit(f"phone search not exactly one {ru}: {buys}")
    texts = open_card()
    print("OPEN")
    for t in texts:
        print(t)


if __name__ == "__main__":
    main()
