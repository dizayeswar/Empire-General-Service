"""Attach latest invoice photo + PIN Charged + SET PIN. Fast crop confirm."""
from __future__ import annotations

import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ADB = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "platform-tools/adb.exe"
)
DIR = Path(__file__).resolve().parent / "logs" / "phone-ui"
SHOT = Path(__file__).resolve().parent / "logs" / "screenshots"


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=25)
    return (r.stdout or "") + (r.stderr or "")


def dump(name: str) -> ET.Element:
    DIR.mkdir(parents=True, exist_ok=True)
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    adb("pull", "/sdcard/uidump.xml", str(DIR / f"{name}.xml"))
    return ET.parse(DIR / f"{name}.xml").getroot()


def texts(root: ET.Element) -> list[str]:
    return [n.attrib.get("text") or "" for n in root.iter("node") if n.attrib.get("text")]


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def bounds_for(root: ET.Element, text: str):
    for n in root.iter("node"):
        if n.attrib.get("text") == text:
            b = n.attrib.get("bounds") or ""
            nums = [int(x) for x in b.replace("][", ",").replace("[", "").replace("]", "").split(",") if x]
            if len(nums) == 4:
                return nums
    return None


def center(b):
    return ((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)


def invoice_image() -> Image.Image:
    """Use the Invoice paper window. Never crop Nova's payments grid."""
    try:
        from nova_search_filter import grab_invoice

        path = grab_invoice("INVOICE")
        print("invoice-source live", path)
        return Image.open(path)
    except Exception as exc:
        print("invoice-source live failed", exc)
    files = sorted(SHOT.glob("*-INVOICE-*.png"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        raise SystemExit("no Invoice window and no INVOICE screenshot")
    print("invoice-source file", files[0])
    return Image.open(files[0])


def push_invoice(dest_name: str) -> None:
    dest = SHOT / dest_name
    im = invoice_image()
    w, h = im.size
    im.crop((w // 2 - 300, 50, w // 2 + 340, h - 40)).convert("RGB").save(dest, quality=90)
    adb("push", str(dest), f"/sdcard/DCIM/Camera/{dest_name}")
    adb(
        "shell",
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        f"file:///sdcard/DCIM/Camera/{dest_name}",
    )


def ru_invoice_name(ru: str) -> str:
    digits = "".join(ch for ch in ru if ch.isdigit())
    return f"invoice-RU-{digits}.jpg"


def main() -> None:
    from bot_switch import require_bot_on

    require_bot_on()
    ru = sys.argv[1]
    dest_name = ru_invoice_name(ru)
    if len(sys.argv) > 2 and ru.replace("RU-", "") in sys.argv[2]:
        dest_name = sys.argv[2]
    print("attach-file", dest_name)
    push_invoice(dest_name)

    root = dump("fin0")
    t = texts(root)
    if ru not in t:
        tap(134, 2144)
        time.sleep(0.8)
        root = dump("fin0b")
        t = texts(root)
    if ru not in t:
        raise SystemExit(f"phone is not on {ru}: {t[:12]}")

    adb("shell", "input", "swipe", "540", "1700", "540", "600", "200")
    time.sleep(0.4)
    root = dump("fin1")
    att = bounds_for(root, "Attachments")
    if not att:
        raise SystemExit("no Attachments field")
    # the input box is the second Attachments or the taller box
    tap(540, att[3] + 80)
    time.sleep(0.8)
    root = dump("fin2")
    gal = bounds_for(root, "GALLERY")
    if not gal:
        raise SystemExit("no GALLERY")
    tap(*center(gal))
    time.sleep(1.4)
    root = dump("fin3")
    picked = None
    for n in root.iter("node"):
        desc = n.attrib.get("content-desc") or ""
        if dest_name in desc and not desc.startswith("Preview"):
            b = n.attrib.get("bounds") or ""
            nums = [int(x) for x in b.replace("][", ",").replace("[", "").replace("]", "").split(",") if x]
            if len(nums) == 4:
                picked = nums
                break
    if not picked:
        raise SystemExit(f"{dest_name} not in gallery")
    tap((picked[0] + picked[2]) // 2, (picked[1] + picked[3] * 3) // 4)
    time.sleep(1.2)
    focus = adb("shell", "dumpsys", "window")
    if "UCropActivity" in focus:
        adb("shell", "settings", "put", "global", "policy_control", "immersive.status=*")
        time.sleep(0.4)
        tap(1031, 65)
        time.sleep(2.0)
        adb("shell", "settings", "delete", "global", "policy_control")
        time.sleep(0.8)

    root = dump("fin4")
    t = texts(root)
    if not any(".jpg" in x.lower() for x in t):
        adb("shell", "input", "swipe", "540", "1700", "540", "600", "200")
        time.sleep(0.3)
        root = dump("fin5")
        t = texts(root)
    if not any(".jpg" in x.lower() for x in t):
        raise SystemExit(f"photo not attached: {t}")

    pin = bounds_for(root, "PIN")
    if not pin:
        raise SystemExit("no PIN field")
    tap(*center(pin))
    time.sleep(0.25)
    adb("shell", "input", "text", "Charged")
    time.sleep(0.2)
    adb("shell", "input", "keyevent", "4")
    time.sleep(0.35)
    root = dump("fin6")
    if "Charged" not in texts(root):
        raise SystemExit(f"PIN not Charged: {texts(root)}")
    sp = bounds_for(root, "SET PIN")
    if not sp:
        raise SystemExit("no SET PIN")
    tap(*center(sp))
    time.sleep(1.2)
    root = dump("fin7")
    t = texts(root)
    print("AFTER")
    for x in t:
        print(x)
    if "Request Completed" in t or "Request was completed successfully!" in t:
        ok = bounds_for(root, "Ok")
        if ok:
            tap(*center(ok))
        else:
            tap(827, 1313)
        print("OK clicked — request finished")


if __name__ == "__main__":
    main()
