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
    root = ET.parse(DIR / f"{name}.xml").getroot()
    t = texts(root)
    if "Exit Application" in t or "Are you Sure you want to exit?" in t:
        from watch_open import dismiss_exit

        dismiss_exit(t, name)
        adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
        adb("pull", "/sdcard/uidump.xml", str(DIR / f"{name}-no.xml"))
        root = ET.parse(DIR / f"{name}-no.xml").getroot()
    return root


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


def on_edit_photo() -> bool:
    """True only if Edit Photo is the focused screen. UCrop stays in dumpsys after close."""
    for ln in adb("shell", "dumpsys", "window").splitlines():
        if "mCurrentFocus" in ln or "mFocusedApp" in ln:
            if "UCropActivity" in ln:
                return True
    return False


def confirm_ucrop() -> bool:
    """Tap the Crop check. The button sits under the status bar — hide it first."""
    if not on_edit_photo():
        return True
    adb("shell", "settings", "put", "global", "policy_control", "immersive.status=*")
    time.sleep(0.5)
    for attempt in range(4):
        root = dump(f"fin-crop{attempt}")
        crop = None
        for n in root.iter("node"):
            desc = (n.attrib.get("content-desc") or "").strip()
            rid = n.attrib.get("resource-id") or ""
            if desc == "Crop" or rid.endswith("menu_crop"):
                b = n.attrib.get("bounds") or ""
                nums = [int(x) for x in b.replace("][", ",").replace("[", "").replace("]", "").split(",") if x]
                if len(nums) == 4:
                    crop = nums
                    break
        if crop:
            tap(*center(crop))
            print("Crop tapped", crop)
        else:
            tap(1012, 78)
            print("Crop fallback (1012,78)")
        time.sleep(1.1)
        if not on_edit_photo():
            adb("shell", "settings", "delete", "global", "policy_control")
            return True
    adb("shell", "settings", "delete", "global", "policy_control")
    return not on_edit_photo()


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
    if dest.exists() and dest.stat().st_size > 2000:
        print("invoice-source existing", dest)
    else:
        im = invoice_image()
        w, h = im.size
        im.crop((w // 2 - 300, 50, w // 2 + 340, h - 40)).convert("RGB").save(dest, quality=90)
    adb("push", str(dest), f"/sdcard/DCIM/Camera/{dest_name}")
    _media_scan(f"/sdcard/DCIM/Camera/{dest_name}")


def _media_scan(path: str) -> None:
    adb(
        "shell",
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        f"file://{path}",
    )


def rename_crop_to_ru(dest_name: str) -> None:
    """UCrop writes IMG_….jpg. Put that crop on the RU name so Gallery never offers a stray IMG_."""
    listing = adb("shell", "ls", "-t", "/sdcard/DCIM/Camera")
    newest_img = ""
    for line in listing.splitlines():
        name = line.strip()
        if name.startswith("IMG_") and name.lower().endswith(".jpg"):
            newest_img = name
            break
    if not newest_img:
        return
    src = f"/sdcard/DCIM/Camera/{newest_img}"
    dest = f"/sdcard/DCIM/Camera/{dest_name}"
    adb("shell", "mv", "-f", src, dest)
    _media_scan(src)
    _media_scan(dest)
    print(f"renamed {newest_img} -> {dest_name}")


def ru_invoice_name(ru: str) -> str:
    digits = "".join(ch for ch in ru if ch.isdigit())
    return f"invoice-RU-{digits}.jpg"


def main() -> None:
    from bot_switch import require_bot_on
    from charge_easy import load_need_pin

    ru = sys.argv[1]
    from watch_open import (
        dismiss_sleep_clock,
        dump_texts,
        phone_has_pin_pad,
        phone_on_login,
        phone_sleep_clock,
        tap_staff_sign_in,
    )

    fin0 = dump_texts("fin-lock")
    if phone_on_login(fin0):
        tap_staff_sign_in()
        fin0 = dump_texts("fin-signin")
        if phone_on_login(fin0):
            print("EMPIRE SIGN IN still up — no type")
            raise SystemExit("empire sign in")
    if phone_has_pin_pad(fin0):
        print("PHONE PIN PAD — no tap, no type")
        raise SystemExit("phone PIN pad")
    if phone_sleep_clock(fin0):
        dismiss_sleep_clock()
        fin0 = dump_texts("fin-lock-swipe")
        if phone_has_pin_pad(fin0) or phone_sleep_clock(fin0):
            print("PHONE still on clock/PIN after swipe")
            raise SystemExit("phone still asleep")
    need = load_need_pin()
    require_bot_on(allow_unread=bool(need and need.get("ru") == ru))
    dest_name = ru_invoice_name(ru)
    if len(sys.argv) > 2 and ru.replace("RU-", "") in sys.argv[2]:
        dest_name = sys.argv[2]
    print("attach-file", dest_name)
    lock = Path(__file__).resolve().parent / "logs" / "setpin.lock"
    lock.write_text(ru, encoding="utf-8")
    try:
        _finish_locked(ru, dest_name)
    finally:
        try:
            lock.unlink()
        except Exception:
            pass


def _finish_locked(ru: str, dest_name: str) -> None:
    push_invoice(dest_name)

    root = dump("fin0")
    t = texts(root)
    if ru not in t:
        raise SystemExit(f"phone is not on {ru}: {t[:12]}")

    att = None
    for _ in range(4):
        adb("shell", "input", "swipe", "540", "1700", "540", "600", "200")
        time.sleep(0.4)
        root = dump("fin1")
        att = bounds_for(root, "Attachments")
        if att:
            break
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
        if desc.startswith("Preview") or desc.startswith("IMG_"):
            continue
        if dest_name in desc:
            b = n.attrib.get("bounds") or ""
            nums = [int(x) for x in b.replace("][", ",").replace("[", "").replace("]", "").split(",") if x]
            if len(nums) == 4:
                picked = nums
                break
    if not picked:
        raise SystemExit(f"{dest_name} not in gallery")
    # Left side of the tile — Preview sits on the right and can open the wrong thing.
    tap(picked[0] + 70, (picked[1] + picked[3]) // 2)
    time.sleep(1.2)
    if on_edit_photo():
        if not confirm_ucrop():
            raise SystemExit("Edit Photo still open after Crop")
        rename_crop_to_ru(dest_name)
        time.sleep(0.6)

    root = dump("fin4")
    t = texts(root)
    if not any(".jpg" in x.lower() for x in t):
        adb("shell", "input", "swipe", "540", "1700", "540", "600", "200")
        time.sleep(0.3)
        root = dump("fin5")
        t = texts(root)
    if not any(".jpg" in x.lower() for x in t):
        raise SystemExit(f"photo not attached: {t}")
    joined = " ".join(t)
    if dest_name in joined:
        print(f"attached {dest_name}")
    elif any(x.startswith("IMG_") and x.lower().endswith(".jpg") for x in t):
        # UCrop labels the request IMG_; the file we picked and renamed is dest_name.
        print(f"attached crop of {dest_name}")
    else:
        raise SystemExit(f"attached file is not {dest_name}: {t}")

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
    t = []
    root = None
    for i in range(8):
        time.sleep(1.0 if i else 1.2)
        root = dump(f"fin7{i}")
        t = texts(root)
        if "Request Completed" in t or "Request was completed successfully!" in t:
            break
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
    else:
        raise SystemExit(f"SET PIN did not finish: {t[:16]}")


if __name__ == "__main__":
    main()
