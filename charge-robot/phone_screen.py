"""Named Empire phone screens. One UI dump, tap by text/bounds, never type a password."""
from __future__ import annotations

import subprocess
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

ADB = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "platform-tools/adb.exe"
)
DIR = Path(__file__).resolve().parent / "logs" / "phone-ui"
PKG = "com.abacuscambridge.empireworldErbil"


@dataclass
class Node:
    text: str
    desc: str
    rid: str
    bounds: tuple[int, int, int, int]
    cls: str = ""


@dataclass
class Ui:
    name: str
    texts: list[str]
    nodes: list[Node] = field(default_factory=list)
    kind: str = "unknown"


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=25)
    return (r.stdout or "") + (r.stderr or "")


def _parse_bounds(raw: str) -> tuple[int, int, int, int] | None:
    nums = [
        int(x)
        for x in (raw or "").replace("][", ",").replace("[", "").replace("]", "").split(",")
        if x
    ]
    if len(nums) == 4:
        return (nums[0], nums[1], nums[2], nums[3])
    return None


def _rid_tail(rid: str) -> str:
    return (rid or "").rsplit("/", 1)[-1]


def parse_nodes(dest: Path) -> list[Node]:
    root = ET.parse(dest).getroot()
    out: list[Node] = []
    for n in root.iter("node"):
        b = _parse_bounds(n.attrib.get("bounds") or "")
        if not b:
            continue
        out.append(
            Node(
                text=n.attrib.get("text") or "",
                desc=n.attrib.get("content-desc") or "",
                rid=n.attrib.get("resource-id") or "",
                bounds=b,
                cls=n.attrib.get("class") or "",
            )
        )
    return out


def texts_of(nodes: list[Node]) -> list[str]:
    return [n.text for n in nodes if n.text]


def tap_xy(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def tap_bounds(b: tuple[int, int, int, int]) -> None:
    tap_xy((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)


def find_text(nodes: list[Node], label: str) -> Node | None:
    found = None
    for n in nodes:
        if n.text == label:
            found = n
    return found


def find_desc(nodes: list[Node], label: str) -> Node | None:
    found = None
    for n in nodes:
        if n.desc == label:
            found = n
    return found


def find_id(nodes: list[Node], tail: str) -> Node | None:
    for n in nodes:
        if _rid_tail(n.rid) == tail:
            return n
    return None


def tap_text(nodes: list[Node], label: str) -> bool:
    n = find_text(nodes, label)
    if not n:
        return False
    tap_bounds(n.bounds)
    return True


def tap_desc(nodes: list[Node], label: str) -> bool:
    n = find_desc(nodes, label)
    if not n:
        return False
    tap_bounds(n.bounds)
    return True


def search_box_value(nodes: list[Node]) -> str:
    n = find_id(nodes, "et_search")
    if not n:
        return ""
    t = (n.text or "").strip()
    if t.lower() in {"requests", "search", "search requests"}:
        return ""
    return t


def is_exit(texts: list[str]) -> bool:
    return "Exit Application" in texts or "Are you Sure you want to exit?" in texts


def is_pin_pad(texts: list[str]) -> bool:
    blob = " ".join(texts)
    if "Emergency call" in blob or "Emergency Call" in blob:
        return True
    if any("•" in t and len(t.replace("•", "").strip()) == 0 for t in texts):
        return True
    if "Enter PIN" in blob or "Enter password" in blob:
        return True
    return False


def is_sign_in(texts: list[str]) -> bool:
    blob = " ".join(texts)
    return "Welcome Back" in blob or "Sign in as Staff" in blob or "SIGN IN" in texts


def is_hello(texts: list[str]) -> bool:
    return "Hello" in texts and "Open" not in texts and "Request ID" not in texts


def is_detail(texts: list[str]) -> bool:
    joined = " ".join(texts)
    if "Buy - RU-" in joined:
        return False
    return "Request ID" in texts or "SET PIN" in texts or (
        "Request Detail" in texts and "Open" not in texts
    )


def is_open_list(texts: list[str]) -> bool:
    if "Getting Requests..." in texts:
        return False
    if is_detail(texts) or is_sign_in(texts) or is_exit(texts) or is_pin_pad(texts):
        return False
    return "Open" in texts and "Requests" in texts


def is_sleep_clock(texts: list[str]) -> bool:
    if is_pin_pad(texts):
        return False
    blob = " ".join(texts)
    empire = any(
        x in texts for x in ("Open", "Hello", "Requests", "Request ID", "SET PIN", "Buy - RU-")
    ) or "Buy - RU-" in blob
    if empire:
        return False
    return "Swipe to unlock" in blob or any("September" in t or "Rabi" in t for t in texts)


def is_open_filter(nodes: list[Node], texts: list[str]) -> bool:
    if not is_open_list(texts) and "Open" not in texts:
        return False
    q = search_box_value(nodes)
    if q.startswith("RU-") or (q and q.upper().startswith("RU")):
        return True
    buys = [t for t in texts if t.startswith("Buy - RU-")]
    return bool(q) and len(buys) <= 1 and "Open" in texts


def classify(nodes: list[Node], texts: list[str]) -> str:
    if is_exit(texts):
        return "exit"
    if is_pin_pad(texts):
        return "pin_pad"
    if is_sleep_clock(texts):
        return "clock"
    if is_sign_in(texts):
        return "sign_in"
    if is_detail(texts):
        return "detail"
    if is_hello(texts):
        return "hello"
    if is_open_filter(nodes, texts):
        return "open_filter"
    if is_open_list(texts):
        return "open"
    if "Getting Requests..." in texts:
        return "loading"
    return "unknown"


def _dump_raw(name: str) -> Ui:
    DIR.mkdir(parents=True, exist_ok=True)
    adb("shell", "uiautomator", "dump", "/sdcard/uidump.xml")
    dest = DIR / f"{name}.xml"
    adb("pull", "/sdcard/uidump.xml", str(dest))
    nodes = parse_nodes(dest)
    texts = texts_of(nodes)
    return Ui(name=name, texts=texts, nodes=nodes, kind=classify(nodes, texts))


def dump_screen(name: str) -> Ui:
    """One dump. Tap NO if Exit Application is up."""
    ui = _dump_raw(name)
    for i in range(4):
        if ui.kind != "exit":
            return ui
        if not tap_text(ui.nodes, "NO"):
            ui = _dump_raw(name)
            if ui.kind != "exit":
                return ui
            if not tap_text(ui.nodes, "NO"):
                return ui
        time.sleep(0.5)
        ui = _dump_raw(f"{name}-no{i}")
    return ui


def dump_texts(name: str) -> list[str]:
    return dump_screen(name).texts


def empire_focused() -> bool:
    focus = adb("shell", "dumpsys", "window")
    for ln in focus.splitlines():
        if "mCurrentFocus" in ln or "mFocusedApp" in ln:
            return PKG in ln
    return PKG in focus


def dismiss_sleep_clock() -> None:
    adb("shell", "input", "keyevent", "224")
    time.sleep(0.2)
    adb("shell", "input", "swipe", "540", "1600", "540", "200", "250")
    time.sleep(0.45)
    focus = adb("shell", "dumpsys", "window")
    if "NotificationShade" in focus:
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.25)


def tap_staff_sign_in(ui: Ui | None = None) -> None:
    """Tap SIGN IN only. Never type email or password."""
    nodes = ui.nodes if ui else dump_screen("signin").nodes
    if tap_text(nodes, "SIGN IN"):
        time.sleep(3.5)
        return
    tap_xy(540, 1680)
    time.sleep(3.5)


def reopen_empire() -> None:
    adb("shell", "input", "keyevent", "224")
    time.sleep(0.15)
    adb("shell", "input", "swipe", "540", "1600", "540", "200", "250")
    time.sleep(0.4)
    focus = adb("shell", "dumpsys", "window")
    if "NotificationShade" in focus:
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.2)
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(1.4)


def tap_staff(nodes: list[Node], which: str) -> bool:
    """Home / Requests on the staff bar. Fallback pixels only if the bar is missing."""
    n = find_desc(nodes, which) or find_text(nodes, which)
    if n and n.bounds[1] >= 1900:
        tap_bounds(n.bounds)
        return True
    if which == "Home":
        tap_xy(134, 2144)
        return True
    if which == "Requests":
        tap_xy(405, 2144)
        return True
    return False


def tap_navigate_up(nodes: list[Node]) -> bool:
    if tap_desc(nodes, "Navigate up"):
        return True
    tap_xy(79, 185)
    return True


def clear_open_search(ui: Ui) -> None:
    """Empty the Requests search so the real Open list is visible."""
    box = find_id(ui.nodes, "et_search")
    if box:
        tap_bounds(box.bounds)
        time.sleep(0.2)
        adb("shell", "input", "keyevent", "123")
        for _ in range(20):
            adb("shell", "input", "keyevent", "67")
        time.sleep(0.6)
        return
    tap_navigate_up(ui.nodes)
    time.sleep(0.8)


def tap_buy_card(nodes: list[Node], ru: str) -> bool:
    label = f"Buy - {ru}"
    n = find_text(nodes, label)
    if not n:
        return False
    tap_bounds(n.bounds)
    return True


def tap_items(nodes: list[Node]) -> bool:
    n = find_text(nodes, "Items") or find_desc(nodes, "Items")
    if n:
        tap_bounds(n.bounds)
        return True
    tap_xy(777, 2118)
    return True
