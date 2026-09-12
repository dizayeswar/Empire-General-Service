"""Collect every Open Buy card. App must already be on Requests."""
from __future__ import annotations

import re
import subprocess
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
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=25)
    return (r.stdout or "") + (r.stderr or "")


def dump(name: str) -> list[str]:
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    adb("pull", "/sdcard/uidump.xml", str(DIR / f"{name}.xml"))
    root = ET.parse(DIR / f"{name}.xml").getroot()
    return [n.attrib.get("text") or "" for n in root.iter("node") if n.attrib.get("text")]


def main() -> None:
    from bot_switch import require_bot_on

    require_bot_on()
    texts = dump("list0")
    if "Open" not in texts:
        adb("shell", "input", "tap", "405", "2144")
        time.sleep(2.5)

    found: dict[str, dict] = {}
    last_sig = ""
    stagnant = 0
    for i in range(22):
        texts = dump(f"list-s{i}")
        buys = [t for t in texts if t.startswith("Buy - RU-")]
        units = [t for t in texts if t.startswith("Unit -")]
        dates = [t for t in texts if re.search(r"-\d{4}$", t) or re.match(r"^\d{1,2} \w{3}", t)]
        print(f"SCROLL {i}", buys, units)
        # pair sequential Buy / Unit / IQD / date blocks
        current = {"date": "", "ru": "", "unit": "", "money": ""}
        for t in texts:
            if re.search(r"September-2026|August-2026|October-2026|July-2026|June-2026", t) or re.match(
                r"^\d{2}-[A-Za-z]+-\d{4}$", t
            ):
                current["date"] = t
            if t.startswith("Buy - RU-"):
                current["ru"] = t.replace("Buy - ", "").strip()
            if t.startswith("Unit -"):
                current["unit"] = t.replace("Unit -", "").strip()
            if "IQD" in t:
                current["money"] = t.replace("IQD", "").replace(",", "").strip()
            if current["ru"] and current["ru"] not in found:
                found[current["ru"]] = {
                    "date": current["date"],
                    "unit": current["unit"],
                    "money": current["money"],
                }
            elif current["ru"] in found:
                row = found[current["ru"]]
                if current["unit"]:
                    row["unit"] = current["unit"]
                if current["money"]:
                    row["money"] = current["money"]
                if current["date"]:
                    row["date"] = current["date"]
        sig = "|".join(buys)
        if sig == last_sig:
            stagnant += 1
            if stagnant >= 2:
                break
        else:
            stagnant = 0
            last_sig = sig
        adb("shell", "input", "swipe", "540", "1900", "540", "720", "320")
        time.sleep(0.45)

    print("FOUND", len(found))
    for ru, row in found.items():
        print(f"{row['date']}\t{ru}\t{row['unit']}\t{row['money']}")


if __name__ == "__main__":
    main()
