"""Website Bot On/Off. Off = stop everything. Fail closed if unread."""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / "logs" / "bot_switch.cache"
QUERY_TIMEOUT = 12
CACHE_ON_SEC = 20


def _read_cache() -> bool | None:
    try:
        data = json.loads(CACHE.read_text(encoding="utf-8"))
        age = time.time() - float(data.get("t") or 0)
        if age < 0 or age > CACHE_ON_SEC:
            return None
        if data.get("on") is True:
            return True
        if data.get("on") is False:
            return False
    except Exception:
        return None
    return None


def _write_cache(on: bool) -> None:
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps({"t": time.time(), "on": on}), encoding="utf-8")
    except Exception:
        pass


def bot_is_on(*, fresh: bool = False) -> bool | None:
    """True / False if the website switch was read. None = unread (timeout or junk)."""
    if not fresh:
        cached = _read_cache()
        if cached is True:
            return True
    sql = "select enabled from charging_bot_state where id = 'default';"
    try:
        r = subprocess.run(
            f'npx supabase db query --linked "{sql}"',
            cwd=str(REPO),
            capture_output=True,
            text=True,
            timeout=QUERY_TIMEOUT,
            shell=True,
        )
    except subprocess.TimeoutExpired:
        print("BOT_SWITCH unread — treat as Off")
        return None
    text = (r.stdout or "") + (r.stderr or "")
    low = text.lower()
    if '"enabled": false' in low or '"enabled":false' in low:
        _write_cache(False)
        return False
    if '"enabled": true' in low or '"enabled":true' in low:
        _write_cache(True)
        return True
    print("BOT_SWITCH unread — treat as Off")
    return None


def require_bot_on(*, fresh: bool = False) -> None:
    on = bot_is_on(fresh=fresh)
    if on is True:
        return
    print("BOT_OFF stop (no Pay, no SET PIN, no phone, no PLANB)")
    if on is False:
        raise SystemExit(3)
    raise SystemExit(4)


if __name__ == "__main__":
    v = bot_is_on(fresh=True)
    print("BOT_ON" if v is True else "BOT_OFF" if v is False else "BOT_UNREAD")
