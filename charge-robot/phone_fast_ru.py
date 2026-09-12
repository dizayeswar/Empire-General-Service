"""Open Requests, search one RU, print texts. Fast path."""
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
DIR.mkdir(parents=True, exist_ok=True)


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=20)
    return (r.stdout or "") + (r.stderr or "")


def dump(name: str) -> list[str]:
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    adb("pull", "/sdcard/uidump.xml", str(DIR / f"{name}.xml"))
    root = ET.parse(DIR / f"{name}.xml").getroot()
    return [n.attrib.get("text") or "" for n in root.iter("node") if n.attrib.get("text")]


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def click_ok_if_done(texts: list[str]) -> list[str]:
    if "Request Completed" in texts or "Request was completed successfully!" in texts:
        tap(827, 1313)
        time.sleep(0.35)
        return dump("fast-ok")
    return texts


def main() -> None:
    from bot_switch import require_bot_on

    require_bot_on()
    ru = sys.argv[1]
    texts = click_ok_if_done(dump("fast0"))
    if ru in texts and ("Request ID" in texts or "Request Detail" in texts):
        print("ALREADY OPEN")
        for t in texts:
            print(t)
        return
    if "Open" not in texts or not any(t.startswith("Buy -") or t == "Getting Requests..." for t in texts):
        tap(405, 2144)
        time.sleep(1.0)
        for _ in range(8):
            texts = dump("fast1")
            if "Getting Requests..." in texts:
                time.sleep(0.7)
                continue
            break
    tap(460, 369)
    time.sleep(0.25)
    adb("shell", "input", "keyevent", "123")
    for _ in range(12):
        adb("shell", "input", "keyevent", "67")
    adb("shell", "input", "text", ru)
    time.sleep(0.9)
    texts = dump("fast-search")
    print("SEARCH")
    for t in texts:
        print(t)
    buys = [t for t in texts if t.startswith("Buy -")]
    if len(buys) != 1 or buys[0] != f"Buy - {ru}":
        raise SystemExit(f"not exactly one {ru}: {buys}")
    tap(540, 980)
    time.sleep(1.2)
    texts = dump("fast-open")
    print("OPEN")
    for t in texts:
        print(t)


if __name__ == "__main__":
    main()
