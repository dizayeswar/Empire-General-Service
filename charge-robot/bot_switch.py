"""Website Bot On/Off. Off = stop everything. Fail closed if unread."""
from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def bot_is_on() -> bool:
    sql = "select enabled from charging_bot_state where id = 'default';"
    r = subprocess.run(
        f'npx supabase db query --linked "{sql}"',
        cwd=str(REPO),
        capture_output=True,
        text=True,
        timeout=55,
        shell=True,
    )
    text = (r.stdout or "") + (r.stderr or "")
    low = text.lower()
    if '"enabled": false' in low or '"enabled":false' in low:
        return False
    if '"enabled": true' in low or '"enabled":true' in low:
        return True
    print("BOT_SWITCH unread — treat as Off")
    return False


def require_bot_on() -> None:
    if bot_is_on():
        return
    print("BOT_OFF stop (no Pay, no SET PIN, no phone, no PLANB)")
    raise SystemExit(3)


if __name__ == "__main__":
    print("BOT_ON" if bot_is_on() else "BOT_OFF")
